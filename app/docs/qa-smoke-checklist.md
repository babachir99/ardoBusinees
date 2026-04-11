# QA Smoke Checklist

## Prerequis
- Application en cours d'execution (`npm run dev` ou `npm start`)
- Base fraiche: executer `npm run seed` puis `npm run qa:seed-auth-fixtures`
- Compte de test valide (ex: `bachir.ba.bb@gmail.com`)
- Au moins un produit `LOCAL` actif avec stock > 0

## Lancement automatique
- Executer `npm run qa:smoke` (mode complet + cleanup auto)
- Executer `npm run qa:smoke -- --readonly` (sans creation de commande)
- En environnement production-like (`next build` + `next start`), le paiement mock peut etre desactive.
- Utiliser `QA_EXPECT_MOCK_PAYMENT=1` uniquement si vous attendez explicitement la confirmation mock.

## 1. Login / Session
- Se connecter avec un compte connu
- Ouvrir `GET /api/profile`
- Attendu: `200` avec `id`, `email`, `role`

## 2. Panier (isolation + stock)
- Vider le panier
- Ajouter un produit local avec une quantite > stock
- Attendu: la quantite est limitee au stock disponible
- Se connecter avec un autre compte
- Attendu: panier vide ou different (pas de partage inter-comptes)

## 3. Checkout
- Lancer `POST /api/orders` depuis le panier
- Attendu: `201` avec `orderIds`
- Lancer `POST /api/payments/mock`
- Si mock actif: `201` et commande `CONFIRMED/PAID`
- Si mock desactive: `403` attendu, la commande reste `PENDING/PENDING` et le smoke ne doit pas casser

## 4. Verification DB
- Si mock actif: verifier la commande `status=CONFIRMED`, `paymentStatus=PAID`
- Si mock actif: verifier le payout `PENDING`
- Si mock inactif: verifier la commande `status=PENDING`, `paymentStatus=PENDING`
- Verifier le stock local: decrement coherent

## 5. Rupture de stock
- Quand stock a 0, retenter ajout panier
- Attendu: `409 Product out of stock`

## 6. Messagerie
- Envoyer message avec lien/email/telephone
- Attendu: `400`
- Envoyer message normal
- Attendu: `201`

## 7. Dashboards
- Espace vendeur: KPIs et tendances refle`tent la nouvelle commande payee
- Espace admin: chiffres globaux actualises

## Nettoyage apres QA
- Supprimer commandes QA + paiement + payouts + events
- Restaurer le stock des produits impactes
- Supprimer les messages QA parasites
