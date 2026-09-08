"""NetworkX graph analytics abstraction for criminal intelligence networks."""

from typing import Any, Dict, List, Optional, Set, Tuple
import networkx as nx
from app.ai_ml.config import aiml_settings


class GraphAnalyticsEngine:
    """Performs graph-theoretic intelligence extraction on case entities and relationships."""

    def __init__(self):
        pass

    def build_graph(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
    ) -> nx.Graph:
        """Construct an undirected NetworkX graph from node and edge collections."""
        g = nx.Graph()
        for n in nodes:
            node_id = str(n.get("id"))
            g.add_node(
                node_id,
                label=n.get("label", node_id),
                type=n.get("type", "Entity"),
                data=n.get("data", {}),
            )
        for e in edges:
            src = str(e.get("source"))
            dst = str(e.get("target"))
            if g.has_node(src) and g.has_node(dst):
                weight = float(e.get("confidence", 100)) / 100.0
                g.add_edge(
                    src,
                    dst,
                    relationship=e.get("relationship", "ASSOCIATED_WITH"),
                    weight=weight,
                )
        return g

    def extract_metrics(self, g: nx.Graph) -> List[Dict[str, Any]]:
        """Calculate degree centrality, betweenness centrality, PageRank, and community IDs."""
        if len(g) == 0:
            return []

        # Centrality measures
        deg_centrality = nx.degree_centrality(g)
        btw_centrality = nx.betweenness_centrality(g) if len(g) > 2 else {n: 0.0 for n in g.nodes}
        pagerank = nx.pagerank(g) if len(g) > 1 else {n: 1.0 for n in g.nodes}

        # Community detection via modularity or connected components
        community_map: Dict[str, int] = {}
        try:
            communities = list(nx.community.greedy_modularity_communities(g))
            for cid, comm in enumerate(communities):
                for node in comm:
                    community_map[node] = cid
        except Exception:
            # Fallback to connected components
            for cid, comp in enumerate(nx.connected_components(g)):
                for node in comp:
                    community_map[node] = cid

        results = []
        for n in g.nodes:
            attrs = g.nodes[n]
            deg = round(deg_centrality.get(n, 0.0), 4)
            btw = round(btw_centrality.get(n, 0.0), 4)
            pr = round(pagerank.get(n, 0.0), 4)
            cid = community_map.get(n, 0)
            is_bridge = btw >= 0.15 or deg >= 0.50

            results.append({
                "node_id": n,
                "label": attrs.get("label", n),
                "entity_type": attrs.get("type", "Entity"),
                "degree_centrality": deg,
                "betweenness_centrality": btw,
                "pagerank": pr,
                "community_id": cid,
                "is_cross_case_bridge": is_bridge,
            })

        # Sort descending by betweenness and degree
        results.sort(key=lambda x: (x["betweenness_centrality"], x["degree_centrality"]), reverse=True)
        return results

    def find_shortest_intelligence_path(
        self,
        g: nx.Graph,
        source_id: str,
        target_id: str,
    ) -> Optional[List[str]]:
        """Compute the shortest path connecting two entities in the network."""
        if not g.has_node(source_id) or not g.has_node(target_id):
            return None
        try:
            return nx.shortest_path(g, source=source_id, target=target_id)
        except nx.NetworkXNoPath:
            return None

    # Convenience alias for interface uniformity
    find_shortest_path = find_shortest_intelligence_path

    def detect_communities(self, g: nx.Graph) -> List[Set[str]]:
        """Detect communities via modularity or connected components."""
        if len(g) == 0:
            return []
        try:
            return [set(c) for c in nx.community.greedy_modularity_communities(g)]
        except Exception:
            return [set(c) for c in nx.connected_components(g)]
