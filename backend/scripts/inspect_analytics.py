import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as s:
        res = await s.execute(text("""
            SELECT 
                TO_CHAR(incident_date, 'YYYY-MM') as month,
                crime_category,
                count(*)
            FROM cases
            WHERE incident_date IS NOT NULL
            GROUP BY month, crime_category
            ORDER BY month DESC
            LIMIT 30;
        """))
        rows = res.fetchall()
        print('Monthly breakdown sample (top 10):')
        for r in rows[:10]:
            print(' ', r)

        res2 = await s.execute(text("""
            SELECT 
                EXTRACT(HOUR FROM incident_time)::int as hour,
                count(*)
            FROM cases
            WHERE incident_time IS NOT NULL
            GROUP BY hour
            ORDER BY hour;
        """))
        print('Hour breakdown (first 10):', res2.fetchall()[:10])

        res3 = await s.execute(text("""
            SELECT 
                area, city, region,
                count(*) as total_events,
                AVG(latitude) as lat,
                AVG(longitude) as lng,
                mode() WITHIN GROUP (ORDER BY crime_type) as top_crime,
                mode() WITHIN GROUP (ORDER BY risk_level) as top_risk
            FROM geo_temporal_events
            GROUP BY area, city, region
            ORDER BY total_events DESC
            LIMIT 15;
        """))
        print('\nGeo events grouped by Area/City (top 10):')
        for r in res3.fetchall()[:10]:
            print(' ', r)

if __name__ == '__main__':
    asyncio.run(check())
