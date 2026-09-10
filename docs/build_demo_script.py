# -*- coding: utf-8 -*-
"""TRINETRA — demo speaking script (PDF).

Plain-language script for the SIH demo video, plus an honest statement of what
is real, what is synthetic, and the government systems the design follows.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, PageBreak, KeepTogether,
                                HRFlowable, ListFlowable, ListItem)

F = r"C:\Windows\Fonts"
pdfmetrics.registerFont(TTFont("A", os.path.join(F, "arial.ttf")))
pdfmetrics.registerFont(TTFont("AB", os.path.join(F, "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("AI", os.path.join(F, "ariali.ttf")))
pdfmetrics.registerFont(TTFont("M", os.path.join(F, "consola.ttf")))
pdfmetrics.registerFont(TTFont("MB", os.path.join(F, "consolab.ttf")))
pdfmetrics.registerFontFamily("A", normal="A", bold="AB", italic="AI", boldItalic="AB")

INK   = colors.HexColor("#0A0A0A")
INK2  = colors.HexColor("#4B5563")
INK3  = colors.HexColor("#9CA3AF")
TEAL  = colors.HexColor("#17A2A2")
TEALL = colors.HexColor("#DDF1F1")
GREEN = colors.HexColor("#0F9B77")
GREENL= colors.HexColor("#D7F0E8")
AMBER = colors.HexColor("#C2711C")
AMBERL= colors.HexColor("#FDEBD3")
RED   = colors.HexColor("#B4436A")
REDL  = colors.HexColor("#FBE9EF")
RULE  = colors.HexColor("#E4E4E7")
PAPER = colors.HexColor("#F4F4F6")
WHITE = colors.white

PW, PH = A4
LM = RM = 16 * mm
CW = PW - LM - RM

S = {
 'h1':    ParagraphStyle('h1', fontName='AB', fontSize=20, leading=24, textColor=INK, spaceAfter=3),
 'sub':   ParagraphStyle('sub', fontName='A', fontSize=10, leading=14, textColor=INK2, spaceAfter=10),
 'h2':    ParagraphStyle('h2', fontName='AB', fontSize=13, leading=17, textColor=TEAL, spaceBefore=13, spaceAfter=5),
 'h3':    ParagraphStyle('h3', fontName='AB', fontSize=10.5, leading=14, textColor=INK, spaceBefore=8, spaceAfter=3),
 'body':  ParagraphStyle('body', fontName='A', fontSize=9.6, leading=14, textColor=INK, spaceAfter=5),
 'say':   ParagraphStyle('say', fontName='A', fontSize=10.4, leading=15.5, textColor=INK),
 'small': ParagraphStyle('small', fontName='A', fontSize=8.4, leading=12, textColor=INK2),
 'th':    ParagraphStyle('th', fontName='AB', fontSize=8.2, leading=11, textColor=WHITE),
 'td':    ParagraphStyle('td', fontName='A', fontSize=8.4, leading=11.6, textColor=INK),
 'tdm':   ParagraphStyle('tdm', fontName='M', fontSize=7.6, leading=10.6, textColor=INK),
 'eyebrow': ParagraphStyle('eyebrow', fontName='MB', fontSize=7.6, leading=10, textColor=TEAL, spaceAfter=3),
 'bullet': ParagraphStyle('bullet', fontName='A', fontSize=9.6, leading=13.8, textColor=INK, leftIndent=10, spaceAfter=2),
}


def P(t, s='body'):
    return Paragraph(t, S[s])


def bullets(items, st='bullet'):
    return ListFlowable([ListItem(Paragraph(i, S[st]), leftIndent=10) for i in items],
                        bulletType='bullet', start='\u2022', bulletFontName='A',
                        bulletFontSize=8, leftIndent=10, spaceAfter=5)


def table(rows, widths, head=INK, mono=()):
    data = []
    for ri, row in enumerate(rows):
        out = []
        for ci, cell in enumerate(row):
            st = 'th' if ri == 0 else ('tdm' if ci in mono else 'td')
            out.append(Paragraph(str(cell), S[st]))
        data.append(out)
    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    cmds = [('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 4.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
            ('BACKGROUND', (0, 0), (-1, 0), head),
            ('LINEBELOW', (0, 0), (-1, -1), 0.4, RULE)]
    for i in range(1, len(data)):
        if i % 2 == 0:
            cmds.append(('BACKGROUND', (0, i), (-1, i), PAPER))
    t.setStyle(TableStyle(cmds))
    return t


def callout(title, body, fg=TEAL, bg=TEALL):
    ts = ParagraphStyle('ct', fontName='AB', fontSize=9, leading=12, textColor=fg, spaceAfter=3)
    bs = ParagraphStyle('cb', fontName='A', fontSize=9.2, leading=13.4, textColor=INK)
    inner = [Paragraph(title, ts), Paragraph(body, bs)]
    t = Table([[inner]], colWidths=[CW], hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), bg),
                           ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
                           ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
    return t


def say(text):
    """A line to speak out loud."""
    bs = ParagraphStyle('sayb', fontName='A', fontSize=10.4, leading=15.5, textColor=INK)
    t = Table([[Paragraph('\u201c' + text + '\u201d', bs)]], colWidths=[CW], hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), WHITE),
                           ('LINEBEFORE', (0, 0), (0, -1), 2.4, TEAL),
                           ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                           ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
    return t


def cover(c, d):
    c.saveState()
    c.setFillColor(colors.HexColor("#0B1417")); c.rect(0, 0, PW, PH, fill=1, stroke=0)
    c.setFillColor(TEAL); c.rect(0, PH - 8 * mm, PW, 8 * mm, fill=1, stroke=0)
    c.restoreState()


def page(c, d):
    c.saveState()
    c.setFillColor(WHITE); c.rect(0, 0, PW, PH, fill=1, stroke=0)
    c.setStrokeColor(RULE); c.setLineWidth(0.5)
    c.line(LM, PH - 13 * mm, PW - RM, PH - 13 * mm)
    c.setFont("M", 7); c.setFillColor(INK3)
    c.drawString(LM, PH - 11.2 * mm, "TRINETRA  |  Demo script  |  SIH26189")
    c.line(LM, 12 * mm, PW - RM, 12 * mm)
    c.drawString(LM, 8.6 * mm, "Synthetic demonstration data. Not real police records.")
    c.setFillColor(TEAL); c.setFont("MB", 7.6)
    c.drawRightString(PW - RM, 8.6 * mm, "%02d" % (d.page - 1))
    c.restoreState()


OUT = r"C:\Users\Sakshi\Desktop\MyAllProjects\criiminal_final\TRINETRA_Demo_Script.pdf"
doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=LM, rightMargin=RM,
                      topMargin=19 * mm, bottomMargin=17 * mm,
                      title="TRINETRA - Demo Script (SIH26189)", author="Team TRINETRA")
doc.addPageTemplates([
    PageTemplate(id='cover', frames=[Frame(LM, 30 * mm, CW, PH - 70 * mm, id='c')], onPage=cover),
    PageTemplate(id='main', frames=[Frame(LM, 17 * mm, CW, PH - 38 * mm, id='m')], onPage=page),
])

E = []

# ------------------------------------------------------------------ COVER
E += [
    Spacer(1, 55 * mm),
    Paragraph("TRINETRA", ParagraphStyle('ct', fontName='AB', fontSize=44, leading=48, textColor=WHITE)),
    Paragraph("Criminal Network Intelligence &amp; Investigation Platform",
              ParagraphStyle('cs', fontName='A', fontSize=13, leading=18, textColor=colors.HexColor("#8FD0CE"))),
    Spacer(1, 10 * mm),
    HRFlowable(width="42%", thickness=2, color=TEAL, spaceAfter=10, hAlign='LEFT'),
    Paragraph("WHAT TO SAY IN THE DEMO<br/>What is real \u2022 What is synthetic \u2022 Why it can be trusted",
              ParagraphStyle('cm', fontName='M', fontSize=9, leading=14, textColor=colors.HexColor("#7FBDBB"))),
    Spacer(1, 12 * mm),
    Paragraph("Problem Statement SIH26189<br/>Ministry of Home Affairs \u2022 National Crime Records Bureau",
              ParagraphStyle('cm2', fontName='M', fontSize=8.4, leading=13, textColor=colors.HexColor("#5E9997"))),
    PageBreak(),
]

# ------------------------------------------------------------------ 1
E.append(P("PART 1", 'eyebrow'))
E.append(P("The most important thing to say", 'h1'))
E.append(P("Start with this. It is the sentence that decides whether the panel trusts everything "
           "that follows.", 'sub'))
E.append(HRFlowable(width="100%", thickness=1.4, color=TEAL, spaceAfter=10))

E.append(say("Real police data is classified, and it should be. So we did not use it. "
             "TRINETRA runs on data we generated ourselves, built to the exact shape of the "
             "records Indian police already keep. Connect a real source and the system works "
             "the same day."))
E.append(Spacer(1, 7))

E.append(P("Why this is the strongest thing you can say", 'h3'))
E.append(bullets([
    "Any team claiming live CCTNS data is not telling the truth. CCTNS needs a police login. "
    "There is no public access, for anyone.",
    "The judges are from NCRB. They know this better than we do. Saying it first shows we did "
    "the homework.",
    "It moves the question from <i>where did you get the data</i> to <i>does the system work</i> "
    "\u2014 which is where we are strong.",
]))

E.append(callout(
    "If someone asks: so nothing here is real?",
    "Plenty is real. The law is real and current. The map coordinates are real Mumbai locations. "
    "The maths is standard, published network analysis. The evidence fingerprinting is real "
    "cryptography. What is invented is the crime itself \u2014 the people, the phone numbers, the "
    "cases. That is the only responsible way to build this outside a police network."))

E.append(PageBreak())

# ------------------------------------------------------------------ 2
E.append(P("PART 2", 'eyebrow'))
E.append(P("What is real and what is made up", 'h1'))
E.append(P("Be able to answer this line by line. Never blur it.", 'sub'))
E.append(HRFlowable(width="100%", thickness=1.4, color=TEAL, spaceAfter=10))

E.append(P("Real \u2014 you can defend every one of these", 'h2'))
E.append(table([
    ["WHAT", "WHY IT IS REAL"],
    ["<b>The law we cite</b>",
     "FIRs use <b>BNS</b> and <b>BNSS</b> sections, the criminal law that replaced the IPC and CrPC "
     "on 1 July 2024. Registration is shown under <b>Section 173 BNSS</b>, not the old Section 154 "
     "CrPC. Offences use BNS sections such as 137 (kidnapping) and 143 (trafficking of person)."],
    ["<b>The map</b>",
     "Every pin is a genuine coordinate. Andheri Metro Station sits at 19.1197\u00b0 N, 72.8464\u00b0 E "
     "\u2014 that is the real place. Map tiles come from OpenStreetMap, which is open data."],
    ["<b>The analysis maths</b>",
     "PageRank, betweenness centrality and Louvain community detection. These are published, peer "
     "reviewed methods used across the world for link analysis. We did not invent a score."],
    ["<b>The evidence fingerprinting</b>",
     "Real <b>SHA-256</b>. Each record's fingerprint includes the one before it, so altering any "
     "record breaks every record after it. That is genuine tamper evidence, not a label."],
    ["<b>The document reading</b>",
     "Real OCR and real extraction. Upload a PDF during the demo and it is read live."],
    ["<b>The data shape</b>",
     "Our fields follow <b>CCTNS</b> (the system every police station files FIRs into) and "
     "<b>ICJS</b> (which links police, courts, prisons, forensic labs and prosecution)."],
], [40 * mm, CW - 40 * mm], head=GREEN))

E.append(Spacer(1, 7))
E.append(P("Made up \u2014 say so plainly", 'h2'))
E.append(table([
    ["WHAT", "WHY"],
    ["Every case record", "1,002 cases. All generated by us."],
    ["Every person, phone, vehicle, bank account",
     "Including Rahul Mehta and the kidnapping itself. No real person is named anywhere."],
    ["The call records and transactions",
     "No public call detail records exist anywhere in the world. Telecom privacy law forbids it. "
     "We generated them using the real CDR field structure."],
], [50 * mm, CW - 50 * mm], head=RED))

E.append(Spacer(1, 7))
E.append(callout(
    "One thing to be careful about",
    "Do not say we are connected to NCRB, CCTNS, ICJS or INTERPOL. We are not. We say our data "
    "<b>follows their structure</b>. That is true, it is defensible, and it is still impressive. "
    "Claiming a connection we do not have is the fastest way to lose the room.",
    AMBER, AMBERL))

E.append(PageBreak())

# ------------------------------------------------------------------ 3
E.append(P("PART 3", 'eyebrow'))
E.append(P("Why the dashboard shows about a thousand cases", 'h1'))
E.append(P("You will be asked this. It is a good question with a good answer.", 'sub'))
E.append(HRFlowable(width="100%", thickness=1.4, color=TEAL, spaceAfter=10))

E.append(say("That number is the case archive, and the system needs it. Step 4 of the analysis "
             "compares this crime against every past case. With ten cases it finds nothing. With a "
             "thousand, across Mumbai, Thane and Navi Mumbai, it finds real matches."))
E.append(Spacer(1, 6))

E.append(P("The detail behind it", 'h3'))
E.append(table([
    ["FIGURE", "WHAT IT IS"],
    ["<b>1,002</b>", "cases in the archive, spanning 2010 to 2026, across three police commissionerates"],
    ["<b>12 months</b>", "of caseload shown in the dashboard trend chart, computed from those records"],
    ["<b>2</b>", "cases fully analysed for this demo \u2014 the rest are the archive that Step 4 searches"],
], [24 * mm, CW - 24 * mm]))

E.append(Spacer(1, 6))
E.append(P("If they push: is the volume just for show?", 'h3'))
E.append(P("No \u2014 and you can prove it live. Open <b>Past Cases</b> on the kidnapping case. The "
           "system searched the archive and returned a genuine match with a similarity score. That "
           "search is only meaningful because the archive has depth.", 'body'))

E.append(PageBreak())

# ------------------------------------------------------------------ 4
E.append(P("PART 4", 'eyebrow'))
E.append(P("The demo, screen by screen", 'h1'))
E.append(P("Roughly six minutes. The words in quotes are what to say.", 'sub'))
E.append(HRFlowable(width="100%", thickness=1.4, color=TEAL, spaceAfter=10))

steps = [
 ("0:00", "Sign in",
  "Real login with four roles. An officer must give a reason before opening any profile, and it is "
  "recorded.",
  "Before anything else \u2014 real police data is classified, so we did not use it. This runs on "
  "data we generated, shaped exactly like the records police already keep."),
 ("0:30", "Dashboard",
  "Case counts, a twelve month caseload chart, live case activity.",
  "A thousand cases across three commissionerates. That archive is what makes comparison against "
  "old cases possible."),
 ("1:00", "Open the kidnapping case",
  "A sixteen year old reported missing from Andheri. Case MUM-2026-KD-48D890.",
  "This is one case file. Watch what the system pulls out of it."),
 ("1:30", "FIR and documents",
  "The extracted people, phones, vehicles and law sections. Point at the BNS section numbers.",
  "These are BNS sections, the law that replaced the IPC in July 2024. The system reads current "
  "law, not the old code."),
 ("2:15", "Analysis steps",
  "Five steps, named in plain words: read the case, work out who is who, build the link chart, "
  "compare with old cases, write the report.",
  "Five steps, and two of them stop for a human. Nothing enters the case without an officer "
  "approving it."),
 ("3:00", "Network",
  "Fourteen entities and thirty two relationships. Click a node \u2014 the panel on the right opens "
  "with that entity's connections and the evidence behind them.",
  "Every line here came from a document. Click any one and it tells you which."),
 ("3:45", "Case map",
  "Five real Mumbai locations: Andheri Metro Station, Lokhandwala, Malad West, Powai, Vile Parle.",
  "These are real coordinates. This is the route the case describes, drawn from the FIR text."),
 ("4:30", "Summary",
  "Three findings, each graded Verified, Supported or Potential, with a confidence figure and its "
  "source. Two ranked leads.",
  "The system never says anyone is guilty. It says here is a link, here is where it came from, "
  "here is how confident it is \u2014 you decide."),
 ("5:15", "Evidence",
  "Click verify: green. Alter the file behind the scenes, verify again: red.",
  "Every file gets a fingerprint at intake. Change one byte and the system knows."),
 ("5:45", "Close",
  "One click produces the case report.",
  "Everything you saw traces back to a document, carries a confidence score, and waits for an "
  "officer to confirm it."),
]

for t, screen, what, line in steps:
    blk = [
        Table([[Paragraph(f"<b>{t}</b>", S['tdm']), Paragraph(f"<b>{screen}</b>", S['td'])]],
              colWidths=[16 * mm, CW - 16 * mm],
              style=TableStyle([('LEFTPADDING', (0, 0), (-1, -1), 0),
                                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                                ('TOPPADDING', (0, 0), (-1, -1), 0)])),
        Paragraph(what, S['small']),
        Spacer(1, 3),
        say(line),
        Spacer(1, 7),
    ]
    E.append(KeepTogether(blk))

E.append(PageBreak())

# ------------------------------------------------------------------ 5
E.append(P("PART 5", 'eyebrow'))
E.append(P("The government systems we follow", 'h1'))
E.append(P("Name these correctly and the panel knows you understand their world.", 'sub'))
E.append(HRFlowable(width="100%", thickness=1.4, color=TEAL, spaceAfter=10))

E.append(table([
    ["SYSTEM", "FULL NAME", "WHAT IT IS"],
    ["<b>CCTNS</b>", "Crime and Criminal Tracking Network &amp; Systems",
     "The software every police station in India uses to file FIRs. Run by NCRB under the Ministry "
     "of Home Affairs. Our data fields follow its structure."],
    ["<b>ICJS</b>", "Inter-operable Criminal Justice System",
     "Links police, courts, prisons, forensic labs and prosecution so they can see each other's "
     "records. TRINETRA is designed as an analysis layer on top of this, not a replacement."],
    ["<b>BNS</b>", "Bharatiya Nyaya Sanhita, 2023",
     "Replaced the Indian Penal Code on 1 July 2024. Our FIRs cite BNS sections."],
    ["<b>BNSS</b>", "Bharatiya Nagarik Suraksha Sanhita, 2023",
     "Replaced the CrPC. FIR registration is under Section 173 BNSS."],
    ["<b>BSA</b>", "Bharatiya Sakshya Adhiniyam, 2023",
     "The new evidence law. It requires a certificate for electronic records \u2014 which is exactly "
     "what our evidence fingerprinting supports."],
    ["<b>NCRB</b>", "National Crime Records Bureau",
     "Keeps national crime data and runs CCTNS. They wrote this problem statement."],
], [20 * mm, 48 * mm, CW - 68 * mm]))

E.append(Spacer(1, 8))
E.append(P("A line worth saying near the end", 'h2'))
E.append(say("BNS Section 111 covers organised crime, and it requires proving repeated unlawful "
             "activity by a syndicate. Proving a pattern across separate cases is exactly what a "
             "link chart does. This system produces the kind of evidence the new law asks for."))

E.append(PageBreak())

# ------------------------------------------------------------------ 6
E.append(P("PART 6", 'eyebrow'))
E.append(P("Hard questions, honest answers", 'h1'))
E.append(P("Short answers work best. Do not over-explain.", 'sub'))
E.append(HRFlowable(width="100%", thickness=1.4, color=TEAL, spaceAfter=10))

E.append(table([
    ["THEY ASK", "YOU SAY"],
    ["Is this real police data?",
     "No, and it cannot be. CCTNS is classified. Our fields follow its structure, so connecting a "
     "real source is a configuration change, not a rewrite."],
    ["How is this different from a crime dashboard?",
     "A dashboard shows what someone already typed in. This reads the documents, works out that two "
     "spellings are one person, and finds links nobody entered."],
    ["What if the AI is wrong?",
     "It is built to be wrong safely. Two of the five steps stop for a human. Every finding carries "
     "a confidence score and its source, and is marked Verified, Supported or Potential. It never "
     "outputs guilt."],
    ["Why no face recognition?",
     "There is no law authorising it in India. The national face recognition system has been "
     "challenged on exactly that point. We use vehicle number plates instead \u2014 lawful, already "
     "used nationwide, and a stronger identifier in poor light."],
    ["Where is the blockchain?",
     "In evidence integrity. Every file is fingerprinted with SHA-256 at intake and the records are "
     "chained, so tampering is provable. We deliberately did not put files on a public chain \u2014 "
     "it is slow, it costs money, and a district headquarters cannot depend on the network."],
    ["Does it scale to a whole state?",
     "The relational database holds the truth and the link chart is rebuilt from it, so the graph "
     "layer can be swapped for a larger one without changing any business rule."],
    ["What about privacy?",
     "An officer must give a reason before opening any profile, and it is logged. No caste or "
     "religion fields. No prediction of anyone's future crime. Data minimisation in line with the "
     "DPDP Act 2023."],
    ["What is genuinely new here?",
     "Deciding who is who. Indian records have no common identifier that can be used to link them, "
     "so we match on name spelling, phone, vehicle and address \u2014 and every match is approved by "
     "an officer and can be undone."],
], [46 * mm, CW - 46 * mm]))

E.append(PageBreak())

# ------------------------------------------------------------------ 7
E.append(P("PART 7", 'eyebrow'))
E.append(P("What is actually working", 'h1'))
E.append(P("Measured on the running system, not estimated. Quote these if asked.", 'sub'))
E.append(HRFlowable(width="100%", thickness=1.4, color=TEAL, spaceAfter=10))

E.append(table([
    ["AREA", "STATE", "DETAIL"],
    ["Sign in and roles", "Working", "Four roles, reason-for-access recorded on every profile view"],
    ["Case list and search", "Working", "1,002 cases, filter and sort"],
    ["Dashboard", "Working", "Counts and a 12 month caseload chart from live records"],
    ["FIR reading", "Working", "PDF and scanned pages, Hindi and English, entities pulled out"],
    ["Five analysis steps", "Working", "Two steps require a human to approve"],
    ["Link chart", "Working", "14 entities, 32 relationships on the demo case; click opens details"],
    ["Case map", "Working", "5 real geocoded Mumbai locations"],
    ["Past cases", "Working", "Searches the archive and returns scored matches"],
    ["Summary and leads", "Working", "3 graded findings, 2 ranked leads, each with sources"],
    ["Evidence fingerprinting", "Working", "SHA-256 with a live tamper check"],
    ["Case report", "Working", "One click export"],
], [40 * mm, 22 * mm, CW - 62 * mm], head=GREEN))

E.append(Spacer(1, 7))
E.append(P("Be honest about these", 'h2'))
E.append(table([
    ["LIMIT", "SAY THIS IF ASKED"],
    ["Only two cases are fully analysed",
     "Running the analysis takes about a minute per case. We analysed two for the demo; the rest are "
     "the archive that the comparison step searches."],
    ["Past cases returns few matches",
     "The archive is generated data, so genuine look-alike crimes are rare in it. On real records "
     "this returns far more."],
    ["Some screens take a few seconds",
     "The database is hosted remotely for the demo. On a police network it sits on the same site."],
], [46 * mm, CW - 46 * mm], head=AMBER))

E.append(Spacer(1, 9))
E.append(callout(
    "The last thing to say",
    "Everything on this screen traces back to a document. Every finding carries a confidence score. "
    "Nothing enters the case without an officer approving it, and every identity match can be "
    "undone. The system does not decide anything \u2014 it makes sure the investigating officer "
    "does not miss anything."))

doc.build(E)
print("WROTE:", OUT, os.path.getsize(OUT), "bytes")
