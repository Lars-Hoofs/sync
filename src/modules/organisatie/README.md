# Organisatie Module

Deze module behandelt organisatiebeheer in de multi-tenant API, inclusief lidmaatschap en rolbeheer.

## Functies

### Organisatiebeheer
- **Aanmaken** van nieuwe organisaties (gebruiker wordt automatisch eigenaar)
- **Ophalen** van organisatie gegevens (alleen voor leden)
- **Bijwerken** van organisatie informatie (eigenaar/beheerder)

### Lidmaatschapsbeheer
- **Bekijken** van alle leden in een organisatie
- **Wijzigen** van lid rollen (eigenaar/beheerder)
- **Verwijderen** van leden uit organisatie (eigenaar/beheerder)
- **Overzicht** van eigen organisatie lidmaatschappen

## Rollen

| Rol | Beschrijving | Rechten |
|-----|-------------|---------|
| `EIGENAAR` | Eigenaar van de organisatie | Volledige controle, kan andere eigenaren aanwijzen |
| `BEHEERDER` | Administrator | Kan leden beheren en organisatie wijzigen, maar geen eigenaarschap overdragen |
| `EDITOR` | Editor | Kan chatbots en content wijzigen |
| `VIEWER` | Kijker | Alleen-lezen toegang tot organisatie resources |

## API Endpoints

### Organisaties
```
POST   /api/v1/organisaties                           - Maak nieuwe organisatie
GET    /api/v1/organisaties/:id                       - Haal organisatie op
PUT    /api/v1/organisaties/:id                       - Update organisatie
GET    /api/v1/organisaties/:id/leden                 - Haal leden op
PATCH  /api/v1/organisaties/:id/leden/:lidId/rol      - Wijzig lid rol
DELETE /api/v1/organisaties/:id/leden/:lidId          - Verwijder lid
```

### Gebruiker Organisaties
```
GET    /api/v1/gebruikers/organisaties                - Haal eigen organisaties op
```

## Gebruik

### Service Layer
```typescript
import { OrganisatieService } from './modules/organisatie';

const organisatieService = new OrganisatieService(prisma);

// Maak nieuwe organisatie
const result = await organisatieService.maakOrganisatie({
  naam: 'Mijn Bedrijf',
  beschrijving: 'Een geweldig bedrijf'
}, userId);

// Haal organisatie op
const organisatie = await organisatieService.getOrganisatieById(orgId, userId);
```

### Controller Layer
```typescript
import { OrganisatieController } from './modules/organisatie';

const controller = new OrganisatieController(organisatieService);
```

## Validatie

Alle input wordt gevalideerd met Zod schemas:
- `maakOrganisatieSchema` - Voor nieuwe organisaties
- `updateOrganisatieSchema` - Voor organisatie updates
- `wijzigLidRolSchema` - Voor rol wijzigingen

## Beveiliging

- Alle endpoints vereisen authenticatie
- Rol-gebaseerde toegangscontrole voor gevoelige acties
- Eigenaar kan niet zichzelf verwijderen
- Minimaal één eigenaar per organisatie vereist

## Database Relaties

```
Organisatie (1) -> (n) OrganisatieLidmaatschap
Gebruiker (1) -> (n) OrganisatieLidmaatschap
Organisatie (1) -> (1) Gebruiker (eigenaar)
```
