
# TXIO Sizer PRO – v2 (kombinierte Limits für PXC7, Onboard-Allocation PXC4/5)

**Deploy:** Inhalt des Ordners `/docs` in dein GitHub-Repo unter `/docs` legen → GitHub Pages: Branch `main`, Folder `/docs`.
`.nojekyll` liegt bereits im Ordner.

**Neu in v2:**
- PXC7: **kombiniertes Gesamtlimit** (HW+Integration): S=100, M=250, L=600 (zusätzlich zu HW/INT Einzellimits).
- **Onboard-Deckung für PXC4/PXC5**: DO, AI_mA, AO_mA (PXC5), sowie UIO-Verteilung auf DI/AIU/AOU werden vor TXM‑Packing berücksichtigt.
- Trace zeigt Onboard- und Kombinationschecks transparent.

**Features (wie besprochen):**
- Preisimport (Excel/CSV; Spalte A=Leistungsnummer, B=Preis).
- Optimierungsmodi: Günstigste / Empfehlung / Beides.
- Exporte: XLSX (voll), XLSX (nur LN+Menge), PDF; Copy (LN+Menge).
- Filter: Kompakt/Modular + Modul‑Featurefilter (Hand, LCD, LED).
- Geräte‑Info‑Viewer; Presets Klein/Mittel/Groß; Rechenweg‑Container.
