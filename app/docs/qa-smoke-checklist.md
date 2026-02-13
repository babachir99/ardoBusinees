# QA Smoke Checklist

## Prerequis
- Application en cours d'execution (`npm run dev`)
- Compte de test valide (ex: `bachir.ba.bb@gmail.com`)
- Au moins un produit `LOCAL` actif avec stock > 0

## Lancement automatique
- Executer `npm run qa:smoke` (mode complet + cleanup auto)
- Executer `npm run qa:smoke -- --readonly` (sans creation de commande)

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
- Attendu: `201` et commande `CONFIRMED/PAID`

## 4. Verification DB
- Verifier la commande: `status=CONFIRMED`, `paymentStatus=PAID`
- Verifier le payout: creation `PENDING`
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
