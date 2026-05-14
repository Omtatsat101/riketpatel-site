#!/usr/bin/env python3
"""
Build editable .docx files for the 1-page teaser résumés + the IA cover letter.

Outputs to:
  C:\\Users\\riket\\OneDrive\\Desktop\\Organized\\5 - Personal Development\\01 - Resume & Cover Letters\\Generated\\

Files generated:
  Riket B Patel — Résumé.docx
  Riket B Patel — Résumé (ADP, Job 597814).docx
  Riket B Patel — Résumé (Internet Archive, Program Coordinator).docx
  Riket B Patel — Cover Letter (Internet Archive, Program Coordinator).docx

Run:
  python scripts/build_resume_docx.py
"""

from pathlib import Path
from docx import Document
from docx.shared import Pt, Inches, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUTPUT_DIR = Path(
    r"C:\Users\riket\OneDrive\Desktop\Organized\5 - Personal Development\01 - Resume & Cover Letters\Generated"
)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Style helpers ─────────────────────────────────────────────────────────

INK = RGBColor(0x11, 0x11, 0x11)
MUTED = RGBColor(0x55, 0x55, 0x55)
ACCENT = RGBColor(0x1A, 0x3A, 0x2A)
HIGHLIGHT = RGBColor(0xB8, 0x86, 0x0B)
RULE = RGBColor(0x1A, 0x1A, 0x1A)

FONT = "Calibri"


def set_run(run, *, size=10.5, bold=False, italic=False, color=INK, font=FONT):
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color


def add_para(doc, *, space_before=0, space_after=2, line_spacing=1.15, align=None):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(space_before)
    pf.space_after = Pt(space_after)
    pf.line_spacing = line_spacing
    if align is not None:
        p.alignment = align
    return p


def add_hr(p):
    """Add a horizontal rule below the paragraph (bottom border)."""
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "8")  # 1pt
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "1A1A1A")
    pBdr.append(bottom)
    pPr.append(pBdr)


def add_hr_top(p):
    """Add a horizontal rule above the paragraph."""
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    top = OxmlElement("w:top")
    top.set(qn("w:val"), "single")
    top.set(qn("w:sz"), "12")  # 1.5pt
    top.set(qn("w:space"), "1")
    top.set(qn("w:color"), "1A1A1A")
    pBdr.append(top)
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "12")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "1A1A1A")
    pBdr.append(bottom)
    pPr.append(pBdr)


def set_margins(doc, top=0.5, bottom=0.5, left=0.55, right=0.55):
    for section in doc.sections:
        section.top_margin = Inches(top)
        section.bottom_margin = Inches(bottom)
        section.left_margin = Inches(left)
        section.right_margin = Inches(right)


def section_header(doc, text):
    p = add_para(doc, space_before=8, space_after=2)
    r = p.add_run(text.upper())
    set_run(r, size=10, bold=True, color=INK)
    r.font.color.rgb = INK
    # Letter spacing via XML
    rPr = r._r.get_or_add_rPr()
    spc = OxmlElement("w:spacing")
    spc.set(qn("w:val"), "28")  # ~1.4pt letter spacing
    rPr.append(spc)
    add_hr(p)
    return p


def name_header(doc, name):
    p = add_para(doc, space_before=0, space_after=2, align=WD_ALIGN_PARAGRAPH.LEFT, line_spacing=1.0)
    r = p.add_run(name.upper())
    set_run(r, size=22, bold=True, color=INK)
    # Wide letter spacing
    rPr = r._r.get_or_add_rPr()
    spc = OxmlElement("w:spacing")
    spc.set(qn("w:val"), "40")
    rPr.append(spc)


def contact_line(doc, parts):
    p = add_para(doc, space_after=2, line_spacing=1.2)
    r = p.add_run(" · ".join(parts))
    set_run(r, size=9.5, color=MUTED)


def headline_bar(doc, text):
    p = add_para(doc, space_before=4, space_after=4, line_spacing=1.2, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = p.add_run(text.upper())
    set_run(r, size=11, bold=True, color=ACCENT)
    rPr = r._r.get_or_add_rPr()
    spc = OxmlElement("w:spacing")
    spc.set(qn("w:val"), "16")
    rPr.append(spc)
    add_hr_top(p)


def summary_para(doc, text_runs):
    """text_runs: list of (text, bold_bool) tuples."""
    p = add_para(doc, space_before=4, space_after=2, line_spacing=1.25)
    for text, bold in text_runs:
        r = p.add_run(text)
        set_run(r, size=10.5, bold=bold, color=INK)


def bullet_with_quote(doc, lead_runs, quote_text=None):
    """Bullet starting with a triangle, optional italic quote at end."""
    p = add_para(doc, space_before=1, space_after=1, line_spacing=1.25)
    p.paragraph_format.left_indent = Inches(0.18)
    p.paragraph_format.first_line_indent = Inches(-0.18)

    arrow = p.add_run("▸  ")
    set_run(arrow, size=10.5, color=HIGHLIGHT, bold=True)

    for text, bold in lead_runs:
        r = p.add_run(text)
        set_run(r, size=10.5, bold=bold, color=INK)

    if quote_text:
        # leading space + italic quote
        q = p.add_run(" " + quote_text)
        set_run(q, size=10.5, italic=True, color=RGBColor(0x2A, 0x2A, 0x2A))


def job_block(doc, role, dates, body_runs):
    """role + right-aligned dates on same line via tab, then body paragraph."""
    p = add_para(doc, space_before=4, space_after=0, line_spacing=1.2)
    # Right tab stop near right margin
    tab_stops = p.paragraph_format.tab_stops
    tab_stops.add_tab_stop(Inches(7.4), WD_ALIGN_PARAGRAPH.RIGHT)

    role_run = p.add_run(role)
    set_run(role_run, size=10.5, bold=True, color=INK)
    p.add_run("\t")
    date_run = p.add_run(dates)
    set_run(date_run, size=9.5, italic=True, color=MUTED)

    body = add_para(doc, space_before=1, space_after=2, line_spacing=1.25)
    for text, bold in body_runs:
        r = body.add_run(text)
        set_run(r, size=10.5, bold=bold, color=INK)


def two_column_block(doc, left_lines, right_lines):
    """Two-column layout via a borderless table."""
    table = doc.add_table(rows=1, cols=2)
    table.autofit = False
    # Set column widths
    table.columns[0].width = Inches(3.65)
    table.columns[1].width = Inches(3.65)
    cells = table.rows[0].cells
    cells[0].width = Inches(3.65)
    cells[1].width = Inches(3.65)

    def fill(cell, lines):
        cell.text = ""  # clear default
        for i, line in enumerate(lines):
            p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.line_spacing = 1.25
            for text, bold in line:
                r = p.add_run(text)
                set_run(r, size=10.5, bold=bold, color=INK)

    fill(cells[0], left_lines)
    fill(cells[1], right_lines)

    # Remove table borders
    tbl = table._tbl
    tblPr = tbl.tblPr
    tblBorders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        b = OxmlElement(f"w:{edge}")
        b.set(qn("w:val"), "nil")
        tblBorders.append(b)
    tblPr.append(tblBorders)


def footnote(doc, text):
    p = add_para(doc, space_before=6, space_after=0, line_spacing=1.2, align=WD_ALIGN_PARAGRAPH.RIGHT)
    r = p.add_run(text)
    set_run(r, size=9, italic=True, color=MUTED)


# ─── Shared header builder ─────────────────────────────────────────────────

CONTACT_PARTS = [
    "56 Benford Ln, Edgewater Park, NJ 08010",
    "(267) 408-6295",
    "Riketpatel@gmail.com",
    "linkedin.com/in/riketpatel",
    "riketpatel.com",
    "Trilingual: English, Hindi, Gujarati",
]


def build_header(doc, headline):
    name_header(doc, "Riket B. Patel")
    contact_line(doc, CONTACT_PARTS)
    headline_bar(doc, headline)


# ─── Shared education + certifications + footnote ──────────────────────────

def edu_certs_block(doc):
    section_header(doc, "Education & Certifications")
    left = [
        [("Pennsylvania State University", True)],
        [("M.P.S. Data Analytics — May 2018", False)],
        [("Graduate Certificate, Business Analytics — Aug 2017", False)],
        [("B.S. Business Administration (Mgmt. & Marketing) — May 2014", False)],
    ]
    right = [
        [("Certified AI Product Management — Dec 2024", True)],
        [("Certified Agile Leader (CAL-1), Scrum Alliance — Jun 2024", True)],
        [("Mental Health First Aider — May 2024", True)],
        [("AWS Cloud Practitioner Path · NJ Real Estate Salesperson", False)],
    ]
    two_column_block(doc, left, right)


def references_footnote(doc, extra=""):
    text = "References available on request."
    if extra:
        text += " " + extra
    footnote(doc, text)


# ─── BUILDER 1: Main résumé ────────────────────────────────────────────────

def build_main_resume():
    doc = Document()
    set_margins(doc)

    build_header(doc, "Product Manager  ·  Healthcare Technology  ·  Agile Leader")

    summary_para(doc, [
        ("Seven years at Merck owning product roadmaps for clinical-data systems across six countries. Removed roughly ", False),
        ("10,000 hours", True),
        (" of annual manual effort and cut a regulated submission cycle from ", False),
        ("six months to about one week", True),
        (". M.S. Data Analytics, Penn State. Certified AI Product Manager and Agile Leader (CAL-1). Currently founder of Legacy Bridge Alliance Group while exploring my next product role.", False),
    ])

    section_header(doc, "Selected Wins")

    bullet_with_quote(doc,
        [("Scale IT for Clinical Portfolio", True),
         (" — eliminated ~10,000 hours of annual manual effort across Delta Fusion, CDI, CDDR, and SLS; delivered ahead of plan; projected to double to 20,000 hours. Leadership recognition (David Dzamba):", False)],
        '"helping the company work smarter, not harder, and scale our clinical portfolio in a cost-efficient way."'
    )
    bullet_with_quote(doc,
        [("A&R Submission Translation (ARST)", True),
         (" — cut China NDA translation cycle from ", False),
         ("6 months to ~1 week", True),
         ("; user research with stakeholders in Japan, China, Germany, Belgium, US.", False)]
    )
    bullet_with_quote(doc,
        [("Squad Lead (2022) + 2× OUTPERFORMED", True),
         (" ratings (2020, 2021) + 20+ peer recognitions on Merck's INSPIRE platform.", False)]
    )
    bullet_with_quote(doc,
        [("Reverse-mentor feedback", True),
         (" from Robert Wiley, Director of Oncology National Account at Merck:", False)],
        '"exceptional in every area we explored…I do not have any further development feedback."'
    )
    bullet_with_quote(doc,
        [("Summer-intern mentor", True),
         (" to Jenny Mao (Cornell Tech master’s student, 2025):", False)],
        '"I truly don\'t think I would have completed my internship so successfully without your mentorship."'
    )

    section_header(doc, "Experience")

    job_block(doc,
        "Product Manager, CRWEG — Clinical Trial Analysis & Reporting · Merck & Co., Inc.",
        "Aug 2018 – Nov 2025",
        [("Owned the product roadmap for 5 clinical-data systems serving Biostatistics, Medical Writing, and Research Decision Sciences across 6 countries. Promoted to ", False),
         ("Squad Lead", True),
         (" (2022). ", False),
         ("SME", True),
         (" for BARDS regulatory audit-readiness across 3 inspection-sensitive systems. ", False),
         ("TCO Data Steward", True),
         (" for Value Team using ", False),
         ("Apptio + Ariba", True),
         (". Change Champion for O365 / Microsoft Teams enterprise adoption. Represented the product line at international strategy sessions in ", False),
         ("Prague, Brussels, Zurich", True),
         (".", False)]
    )

    job_block(doc,
        "Solution Specialist II → EHR Application Specialist · NextGen Healthcare, Horsham, PA",
        "May 2014 – Apr 2017",
        [("Mirth Connect & EHR client implementations. HL7 / FHIR / SQL Server troubleshooting. Built deep domain expertise in ", False),
         ("HIPAA, ICD-10, Health Information Exchange, and clinical documentation", True),
         (" — foundation for the later regulated-environment work.", False)]
    )

    job_block(doc,
        "Founder · Legacy Bridge Alliance Group",
        "2025 – present",
        [("Holding company for ", False),
         ("Metta Realty Partners", True),
         (" (NJ real estate, HomeSmart affiliate) and ", False),
         ("Metta Legacy Partners", True),
         (" (business brokerage), plus consumer e-commerce (KiddieSketch, KiddieGo). Also operate four free public-good sites: KiddieWordle (17 languages), BestPythonCourse, LoanRatesFinder, FreeRateFinder.", False)]
    )

    edu_certs_block(doc)

    references_footnote(doc, "Longer narrative, side projects, and stories at riketpatel.com.")

    out = OUTPUT_DIR / "Riket B Patel — Résumé.docx"
    doc.save(out)
    print(f"✓ {out.name}")


# ─── BUILDER 2: ADP-tailored résumé ────────────────────────────────────────

def build_adp_resume():
    doc = Document()
    set_margins(doc)

    build_header(doc, "Product Manager  ·  Enterprise SaaS  ·  Regulated Data & AI")

    summary_para(doc, [
        ("Seven years owning enterprise SaaS product roadmaps at Merck across teams in six countries. Removed ~", False),
        ("10,000 hours", True),
        (" of annual manual effort and cut a regulated submission cycle from ", False),
        ("six months to about one week", True),
        (". Familiar with SOX-adjacent compliance, multi-jurisdiction localization, audit-readiness, and AI / ML integration. M.S. Data Analytics, Penn State. Certified AI Product Manager + Agile Leader (CAL-1).", False),
    ])

    section_header(doc, "Selected Wins (HCM SaaS-Adjacent)")

    bullet_with_quote(doc,
        [("Scale IT for Clinical Portfolio", True),
         (" — eliminated ~10,000 hours of annual manual effort across 4 interconnected systems; same operating pattern as automating recurring payroll-prep, time-attestation, and reporting workflows at scale. Leadership recognition (David Dzamba):", False)],
        '"helping the company work smarter, scale cost-efficiently."'
    )
    bullet_with_quote(doc,
        [("A&R Submission Translation", True),
         (" — cut China NDA translation cycle from ", False),
         ("6 months to ~1 week", True),
         ("; HCM analog: multi-jurisdiction localization for payroll filings, benefits docs, onboarding flows.", False)]
    )
    bullet_with_quote(doc,
        [("TCO Data Steward", True),
         (" for Value Team using ", False),
         ("Apptio + Ariba", True),
         (" — aligned financial models with executive reporting. Direct fit for ADP enterprise SaaS financial modeling work.", False)]
    )
    bullet_with_quote(doc,
        [("BARDS audit-readiness SME", True),
         (" across 3 inspection-sensitive systems (audit trail, user access, data integrity) — comparable rigor to ADP's SOC 2 / IRS / state-payroll audit posture.", False)]
    )
    bullet_with_quote(doc,
        [("Squad Lead (2022) + 2× OUTPERFORMED", True),
         (" ratings (2020, 2021) + 20+ peer recognitions. Reverse-mentee (Robert Wiley, Director, Merck):", False)],
        '"exceptional in every area we explored."'
    )

    section_header(doc, "Experience")

    job_block(doc,
        "Product Manager, CRWEG · Merck & Co., Inc., Upper Gwynedd, PA",
        "Aug 2018 – Nov 2025",
        [("Enterprise SaaS product manager across 5 interconnected clinical-data systems serving 15+ stakeholder groups in 6 countries. Promoted to ", False),
         ("Squad Lead", True),
         (" (2022). Change Champion for O365 / Microsoft Teams enterprise adoption. International strategy sessions in ", False),
         ("Prague, Brussels, Zurich", True),
         (" on cloud modernization and AI / ML integration.", False)]
    )

    job_block(doc,
        "Solution Specialist II → EHR Application Specialist · NextGen Healthcare, Horsham, PA",
        "May 2014 – Apr 2017",
        [("Mirth Connect & EHR client implementations. HL7 / FHIR / SQL Server troubleshooting. Domain expertise in ", False),
         ("HIPAA, ICD-10, Health Information Exchange, clinical documentation", True),
         (".", False)]
    )

    job_block(doc,
        "Founder · Legacy Bridge Alliance Group",
        "2025 – present",
        [("Multi-tenant ops experience as small-business owner-operator: Metta Realty Partners (NJ real estate, HomeSmart affiliate), Metta Legacy Partners (business brokerage), consumer e-commerce (KiddieSketch, KiddieGo). Builds empathy with ADP's small-business and mid-market customer base.", False)]
    )

    edu_certs_block(doc)
    references_footnote(doc, "Longer narrative and side projects at riketpatel.com.")

    out = OUTPUT_DIR / "Riket B Patel — Résumé (ADP, Job 597814).docx"
    doc.save(out)
    print(f"✓ {out.name}")


# ─── BUILDER 3: Internet Archive résumé ────────────────────────────────────

def build_ia_resume():
    doc = Document()
    set_margins(doc)

    build_header(doc, "Program Coordination  ·  Cross-Functional Operations  ·  Free-Access Builder")

    summary_para(doc, [
        ("Seven years coordinating multi-system product programs at Merck across six countries. Removed ~", False),
        ("10,000 hours", True),
        (" of annual manual effort and cut a regulated submission cycle from ", False),
        ("six months to about one week", True),
        (". Outside work I run four free, ad-light public-good sites (KiddieWordle in 17 languages, BestPythonCourse, LoanRatesFinder, FreeRateFinder). Universal access to knowledge isn't a pivot — it's already the lane.", False),
    ])

    section_header(doc, "Selected Wins (Program-Ops Translatable)")

    bullet_with_quote(doc,
        [("Scale IT for Clinical Portfolio", True),
         (" — coordinated a 4-system program that eliminated ~10,000 hours of annual manual effort; same operating pattern as freeing a small staff to do mission work instead of repetitive prep. Leadership recognition (David Dzamba):", False)],
        '"helping the company work smarter, scale cost-efficiently."'
    )
    bullet_with_quote(doc,
        [("A&R Submission Translation", True),
         (" — cut a regulated translation cycle from ", False),
         ("6 months to ~1 week", True),
         ("; user research in Japan, China, Germany, Belgium, US. Comfortable building for users whose language, time zone, and context are not my own.", False)]
    )
    bullet_with_quote(doc,
        [("BARDS audit-readiness SME", True),
         (" across 3 systems (audit trail, user access, data integrity) — same documentation rigor a grant report or accession workflow requires.", False)]
    )
    bullet_with_quote(doc,
        [("Squad Lead (2022) + 2× OUTPERFORMED", True),
         (" ratings. Mentored Cornell Tech master's intern Jenny Mao through her 2025 Merck summer:", False)],
        '"I truly don\'t think I would have completed my internship so successfully without your mentorship."'
    )
    bullet_with_quote(doc,
        [("Free public-good sites", True),
         (": KiddieWordle (Wordle for kids in 17 languages, no in-play ads), BestPythonCourse, LoanRatesFinder, FreeRateFinder. Same instinct the Archive operates on, on a smaller scale.", False)]
    )

    section_header(doc, "Experience")

    job_block(doc,
        "Program Lead / Product Manager, CRWEG · Merck & Co., Inc., Upper Gwynedd, PA",
        "Aug 2018 – Nov 2025",
        [("Coordinated a multi-system product program for Biostatistics, Medical Writing, and Research Decision Sciences in 6 countries. Promoted to ", False),
         ("Squad Lead", True),
         (" (2022). International working sessions in Prague, Brussels, Zurich. Active member of Interfaith Organization, Next Gen Network, and capABILITY Network (disability inclusion) ERGs.", False)]
    )

    job_block(doc,
        "Solution Specialist II → EHR Application Specialist · NextGen Healthcare, Horsham, PA",
        "May 2014 – Apr 2017",
        [("Healthcare-client coordination, Mirth Connect / EHR implementations, HL7 / FHIR / SQL. Domain knowledge in HIPAA, ICD-10, Health Information Exchange, clinical documentation. Authored SOPs aligned to Public Health policy.", False)]
    )

    job_block(doc,
        "Founder · Legacy Bridge Alliance Group + free public-good sites",
        "2025 – present",
        [("One-person program-ops practice running on JIRA / Make.com / Google Workspace. Coordinate vendors, partners, fulfillment, and editorial across multiple workstreams. Currently also setting up a Python & generative-AI teacher position in my family's village in Anand, Gujarat — continuing my father's promise to give back there.", False)]
    )

    edu_certs_block(doc)
    references_footnote(doc, "Cover letter pairs with this résumé. Longer narrative at riketpatel.com.")

    out = OUTPUT_DIR / "Riket B Patel — Résumé (Internet Archive, Program Coordinator).docx"
    doc.save(out)
    print(f"✓ {out.name}")


# ─── BUILDER 4: Internet Archive cover letter ──────────────────────────────

def build_ia_cover_letter():
    doc = Document()
    set_margins(doc, top=0.75, bottom=0.75, left=0.85, right=0.85)

    # Sender header
    p = add_para(doc, space_after=2, line_spacing=1.0)
    r = p.add_run("Riket B. Patel")
    set_run(r, size=19, bold=True, color=INK)
    rPr = r._r.get_or_add_rPr()
    spc = OxmlElement("w:spacing")
    spc.set(qn("w:val"), "24")
    rPr.append(spc)

    contact_line(doc, [
        "56 Benford Ln, Edgewater Park, NJ 08010",
        "(267) 408-6295",
        "Riketpatel@gmail.com",
        "linkedin.com/in/riketpatel",
        "riketpatel.com",
    ])

    # Date
    p = add_para(doc, space_before=16, space_after=12, line_spacing=1.3)
    r = p.add_run("May 14, 2026")
    set_run(r, size=11, color=INK)

    # To block
    for line in [
        "Hiring Team",
        "Internet Archive",
        "300 Funston Avenue",
        "San Francisco, CA 94118",
    ]:
        p = add_para(doc, space_after=0, line_spacing=1.3)
        r = p.add_run(line)
        set_run(r, size=11, color=INK)

    # Salutation
    p = add_para(doc, space_before=16, space_after=8, line_spacing=1.4)
    r = p.add_run("Dear Hiring Team,")
    set_run(r, size=11.5, color=INK)

    # Paragraphs
    def body_para(text_runs):
        p = add_para(doc, space_after=8, line_spacing=1.5)
        for text, bold, italic in text_runs:
            r = p.add_run(text)
            set_run(r, size=11.5, bold=bold, italic=italic, color=INK)

    def subhead(text):
        p = add_para(doc, space_before=10, space_after=4, line_spacing=1.4)
        r = p.add_run(text)
        set_run(r, size=12, bold=True, color=ACCENT)

    body_para([
        ("I am writing to express my interest in the Program Coordinator role at the Internet Archive. With 7+ years of cross-functional program ownership at Merck — including running multi-system programs that eliminated roughly 10,000 hours of manual effort a year across teams in the US, Europe, and Asia-Pacific — I am drawn to the Archive's mission of universal access to knowledge. The work I already do on my own time points in that same direction, which is why this role feels less like a career pivot and more like a continuation.", False, False),
    ])

    subhead("My professional journey")
    body_para([
        ("At Merck & Co., I led the Scale IT for Clinical Portfolio program — coordinating delivery across four interconnected clinical-data systems (Delta Fusion, CDI, CDDR, SLS) and 15+ stakeholder groups across six countries. The program eliminated about 10,000 hours of annual manual effort, was delivered ahead of plan, and is on track to double to 20,000 hours. I also designed and shipped the A&R Submission Translation platform, which cut the China NDA translation cycle from about six months to about one week — through user research with stakeholders in Japan, China, Germany, Belgium, and the US. I was promoted to Squad Lead in 2022, served as the regulatory subject-matter expert for audit-readiness across three inspection-sensitive systems, and earned OUTPERFORMED ratings in both 2020 and 2021. My summer intern Jenny Mao — a Cornell Tech master's student spending the summer of 2025 on our team — later wrote: ", False, False),
        ('"I truly don\'t think I would have completed my internship so successfully without your mentorship."', False, True),
        (" That sentence is the one I'm proudest of from the whole tenure.", False, False),
    ])

    subhead("Why the Internet Archive")
    body_para([
        ("My family came to America from a small village in Anand, Gujarat, India. My father made a public promise at his farewell event there to always give back to that village. I am continuing that promise now — right now, I am setting up a Python and generative-AI teacher position in our village so the kids growing up where my parents grew up have access to the same tools the rest of the world is learning. That is the same instinct the Internet Archive operates on: useful tools and knowledge should be free, reachable, and built for the people who need them most.", False, False),
    ])

    body_para([
        ("On my own time I also run a small set of free, ad-light public-good projects: ", False, False),
        ("KiddieWordle", True, False),
        (", a Wordle for younger players in seventeen languages with no ads in the play area; ", False, False),
        ("BestPythonCourse", True, False),
        (", plain-English guides for people learning Python without being upsold into a $300 course; and ", False, False),
        ("LoanRatesFinder", True, False),
        (" and ", False, False),
        ("FreeRateFinder", True, False),
        (", free mortgage- and loan-rate references with simple calculators. None of those will make anyone rich. That's the point. I keep building them anyway.", False, False),
    ])

    subhead("Personal motivation and authenticity")
    body_para([
        ("As someone who navigates life with ADHD, I bring a unique perspective to product and program design — I naturally think about cognitive load, accessibility, and user experience through a lens of lived experience. This drives my commitment to building products and programs that work for everyone, which is the same commitment that drew me to the Internet Archive's work. I am also a Certified Mental Health First Aider (2024); I picked that up because too many people I respected were struggling silently and I wanted to be useful before they had to ask.", False, False),
    ])

    subhead("A note on the title")
    body_para([
        ("My most recent title at Merck was Product Manager, not Program Coordinator. I'd rather put that in front of you honestly than dress it up. The skills underneath — multi-stakeholder coordination, documentation discipline, working in regulated and audit-sensitive contexts, mentoring — are the ones this role seems to ask for. If the role is more senior than the title suggests, even better. If it's more entry-level than I'd guess from the description, I am also willing to have that conversation honestly. I'd rather start at the right level at an organization whose mission I'd be proud to point my son toward someday than chase a title at one I wouldn't.", False, False),
    ])

    body_para([
        ("My résumé, tailored to this role, is at riketpatel.com/resume/internet-archive/. My broader portfolio of side projects, including the free sites mentioned above, is at riketpatel.com. I would welcome a conversation at your convenience and look forward to hearing from you.", False, False),
    ])

    body_para([
        ("Thank you for the time and the work you do.", False, False),
    ])

    # Signoff
    p = add_para(doc, space_before=10, space_after=4, line_spacing=1.4)
    r = p.add_run("Best regards,")
    set_run(r, size=11.5, color=INK)

    p = add_para(doc, space_after=2, line_spacing=1.3)
    r = p.add_run("Riket B. Patel")
    set_run(r, size=11.5, bold=True, color=INK)

    for line in [
        "Product Manager · Master's in Data Analytics, Pennsylvania State University",
        "Certified Artificial Intelligence Product Manager · Certified Agile Leader (CAL-1), Scrum Alliance",
        "Certified Mental Health First Aider · NJ Real Estate Salesperson",
    ]:
        p = add_para(doc, space_after=0, line_spacing=1.3)
        r = p.add_run(line)
        set_run(r, size=10.5, color=MUTED)

    out = OUTPUT_DIR / "Riket B Patel — Cover Letter (Internet Archive, Program Coordinator).docx"
    doc.save(out)
    print(f"✓ {out.name}")


# ─── Main ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"Building .docx files into: {OUTPUT_DIR}")
    build_main_resume()
    build_adp_resume()
    build_ia_resume()
    build_ia_cover_letter()
    print()
    print("Done.")
