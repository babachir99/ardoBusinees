# JONTAADO Legal Pack Notes

## Scope delivered

This markdown tracks the legal foundation added in the app for the Trust Center.

### Documents drafted
- Marketplace CGU
- Vertical annexes
- Privacy / RGPD policy
- Cookies policy
- Moderation / reviews / reports policy
- Legal notices

### Routes added or upgraded
- `/[locale]/trust`
- `/[locale]/trust/terms`
- `/[locale]/trust/verticals`
- `/[locale]/trust/privacy`
- `/[locale]/trust/cookies`
- `/[locale]/trust/moderation`
- `/[locale]/trust/legal-notices`

## Architecture choice

Recommended structure retained:
- one global marketplace terms document
- one vertical annexes document
- one global privacy policy
- one cookies policy
- one moderation and reviews policy
- one legal notices page

Rationale:
- one account system
- one marketplace platform
- mostly transversal data processing
- vertical-specific rules live better in annexes than duplicated full legal packs

## Senegal-first positioning

The legal pack should be read as:
- Senegal-first for the main corporate and operational base
- product-structured in a way that can also absorb GDPR requirements if JONTAADO targets EU users or processes EU-resident data in scope

Core legal references now prioritized in the written pack:
- Senegal Law No. 2008-08 of 25 January 2008 on electronic transactions
- Senegal Law No. 2008-12 of 25 January 2008 on personal data protection
- oversight by the CDP (Commission de Protection des Donnees Personnelles)

## Main legal assumptions to validate before production

### Corporate information
- exact legal entity name
- company registration number
- NINEA
- registered office address
- VAT number if applicable
- publication director
- legal contact email
- privacy contact email
- DPO details if one is formally designated
- hosting provider legal details

### Marketplace business model
- whether JONTAADO is only intermediary on every vertical
- whether JONTAADO is merchant of record on some flows
- exact commissions / service fees / ad fees
- refund policy and cancellation logic by vertical
- mediation and dispute resolution process
- seller professional vs non-professional labeling rules in UI

### Privacy / compliance
- final records of processing activities
- lawful bases per processing
- definitive retention matrix
- real list of processors and sub-processors
- transfers outside EU, if any
- incident response workflow
- DSAR workflow
- cookie CMP setup and categories

### Sensitive data alert
The `Cares` vertical may create high legal exposure.
If health data is actually collected, a dedicated sensitive-data review is required before production.

## Sources used for drafting

### Senegal law
- Loi n 2008-08 du 25 janvier 2008 sur les transactions electroniques:
  https://www.wipo.int/wipolex/edocs/lexdocs/laws/fr/sn/sn012fr.html
- Loi n 2008-12 du 25 janvier 2008 sur la protection des donnees a caractere personnel:
  https://www.wipo.int/wipolex/en/legislation/details/6229
- Commission de Protection des Donnees Personnelles (CDP):
  https://senegalservices.sn/services-administratifs/commission-de-protection-des-donnees-personnelles

### GDPR / EU law
- GDPR articles 12 to 14 and related transparency obligations:
  https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679

### French consumer / marketplace rules
- Code de la consommation, article L111-7:
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049571125/
- Code de la consommation, article L111-7-2:
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033207118
- Code de la consommation, article L221-5:
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226876
- Code de la consommation, article L221-14:
  https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000032226854
- LCEN article 19:
  https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000032236011

### CNIL guidance
- Data retention:
  https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees
- Controller / processor roles:
  https://www.cnil.fr/fr/node/167268
- Cookies rules:
  https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles
- Cookies law explainer:
  https://www.cnil.fr/cookies-et-traceurs-que-dit-la-loi
- Multi-device consent guidance:
  https://www.cnil.fr/fr/cookies-et-autres-traceurs-recommandations-finales-sur-le-consentement-multi-terminaux

## Product follow-ups recommended
- add real legal entity data to legal notices and privacy pages
- wire cookie preferences UI to the written cookies policy
- expose seller professional status clearly on listings and checkout flows
- document sponsored ranking / boosts visibly in marketplace UI
- add dedicated health-data review before expanding `Cares`
- add metadata / SEO for the new trust pages if needed

## Legal review note
These documents are a solid operational draft for product and compliance alignment.
They still require review by qualified legal counsel before production release.

