
-- ============================================================
-- SEED: Mock Data — Agências, Proprietários e Imóveis
-- ============================================================

-- 1. AGÊNCIAS (para imóveis do tipo rental)
INSERT INTO public.agencies (id, name, email, phone) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Roma Rentals Srl',        'info@romarentals.it',      '+39 06 1234 5678'),
  ('a1000000-0000-0000-0000-000000000002', 'Eternal City Properties', 'bookings@eternalcity.it',  '+39 06 2345 6789'),
  ('a1000000-0000-0000-0000-000000000003', 'Vista Roma Agency',       'contact@vistaroma.com',    '+39 06 3456 7890');

-- 2. PROPRIETÁRIOS PARTICULARES
INSERT INTO public.owners (id, name, email, phone) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'Marco Rossi',      'marco.rossi@email.it',      '+39 339 111 2233'),
  ('b2000000-0000-0000-0000-000000000002', 'Giulia Bianchi',   'giulia.bianchi@gmail.com',  '+39 347 222 3344'),
  ('b2000000-0000-0000-0000-000000000003', 'Antonio Ferrari',  'a.ferrari@libero.it',       '+39 333 333 4455'),
  ('b2000000-0000-0000-0000-000000000004', 'Sofia Conti',      'sofia.conti@email.it',      '+39 320 444 5566'),
  ('b2000000-0000-0000-0000-000000000005', 'Francesco Lombardi','f.lombardi@outlook.com',   '+39 345 555 6677');

-- 3. IMÓVEIS — 5 Rental + 5 Particular
INSERT INTO public.properties (
  id, name, client_type, agency_id, owner_id,
  zone, phone, email, address, zip_code,
  sqm_interior, sqm_exterior, sqm_total,
  min_guests, max_guests, double_beds, single_beds, sofa_beds, bathrooms, bidets, cribs,
  base_price, extra_per_person, avg_cleaning_hours, notes
) VALUES

-- ── RENTAL 1 ── Roma Rentals · San Pietro
(
  'c3000000-0000-0000-0000-000000000001',
  'Appartamento San Pietro A',
  'rental', 'a1000000-0000-0000-0000-000000000001', NULL,
  'Saint Peter', '+39 06 1234 5678', 'sanpietro-a@romarentals.it',
  'Via della Conciliazione, 18 - Int. 4', '00193',
  65, 0, 65,
  1, 4, 2, 0, 0, 1, 1, 1,
  90.00, 15.00, 2.5,
  'Chiavi in cassetta al piano terra. Accesso con codice 1234. Attenzione al parquet del soggiorno.'
),

-- ── RENTAL 2 ── Roma Rentals · Colosseo
(
  'c3000000-0000-0000-0000-000000000002',
  'Loft Colosseo Vista',
  'rental', 'a1000000-0000-0000-0000-000000000001', NULL,
  'Colosseum', '+39 06 1234 5679', 'loft-colosseo@romarentals.it',
  'Via Sacra, 7 - Int. 2A', '00186',
  50, 10, 60,
  1, 2, 1, 0, 1, 1, 1, 0,
  75.00, 12.00, 2.0,
  'Terrazzino com vista para o Coliseu. Limpeza das almofadas do terraço incluída na OS.'
),

-- ── RENTAL 3 ── Eternal City · Piazza Navona
(
  'c3000000-0000-0000-0000-000000000003',
  'Suite Navona Centro',
  'rental', 'a1000000-0000-0000-0000-000000000002', NULL,
  'Piazza Navona', '+39 06 2345 6789', 'navona@eternalcity.it',
  'Via dei Coronari, 42 - Int. 1', '00186',
  80, 5, 85,
  2, 6, 2, 2, 0, 2, 2, 1,
  120.00, 20.00, 3.5,
  'Imóvel histórico com tetos afrescados. Usar apenas produtos neutros nas paredes e tetos.'
),

-- ── RENTAL 4 ── Eternal City · Trastevere
(
  'c3000000-0000-0000-0000-000000000004',
  'Casa Trastevere Giardino',
  'rental', 'a1000000-0000-0000-0000-000000000002', NULL,
  'Trastevere Area', '+39 06 2345 6790', 'trastevere@eternalcity.it',
  'Vicolo del Cedro, 11', '00153',
  95, 30, 125,
  2, 8, 3, 2, 0, 2, 2, 2,
  150.00, 18.00, 4.0,
  'Jardim privativo. Limpeza do jardim não incluída. Verificar acesso pela porta lateral na Vicolo.'
),

-- ── RENTAL 5 ── Vista Roma · Parioli
(
  'c3000000-0000-0000-0000-000000000005',
  'Penthouse Parioli Premium',
  'rental', 'a1000000-0000-0000-0000-000000000003', NULL,
  'Parioli', '+39 06 3456 7890', 'parioli@vistaroma.com',
  'Viale dei Parioli, 88 - 5° Piano', '00197',
  140, 40, 180,
  2, 10, 4, 2, 1, 3, 3, 2,
  220.00, 25.00, 5.5,
  'Penthouse com terraço panorâmico. Usar aspirador especial para carpetes. Elevador com codice 5678.'
),

-- ── PARTICULAR 1 ── Marco Rossi · Spanish Steps
(
  'c3000000-0000-0000-0000-000000000006',
  'Bilocale Scalini di Spagna',
  'particular', NULL, 'b2000000-0000-0000-0000-000000000001',
  'Spanish Steps', '+39 339 111 2233', 'marco.rossi@email.it',
  'Via Condotti, 23 - Int. 3', '00187',
  55, 0, 55,
  1, 3, 1, 1, 0, 1, 1, 0,
  85.00, 10.00, 2.0,
  'Marco deixa as chaves com a porteira Signora Anna no 1° piano. Horário: 8h–12h.'
),

-- ── PARTICULAR 2 ── Giulia Bianchi · Fontana di Trevi
(
  'c3000000-0000-0000-0000-000000000007',
  'Monolocale Trevi Romantico',
  'particular', NULL, 'b2000000-0000-0000-0000-000000000002',
  'Trevi Fountain', '+39 347 222 3344', 'giulia.bianchi@gmail.com',
  'Via delle Muratte, 9 - Int. 6B', '00187',
  38, 0, 38,
  1, 2, 1, 0, 0, 1, 1, 0,
  60.00, 8.00, 1.5,
  'Giulia pede atenção especial ao banheiro de mármore. Usar apenas pano macio no mármore.'
),

-- ── PARTICULAR 3 ── Antonio Ferrari · Campo de Fiori
(
  'c3000000-0000-0000-0000-000000000008',
  'Trilocale Campo de'' Fiori',
  'particular', NULL, 'b2000000-0000-0000-0000-000000000003',
  'Campo de''Fiori', '+39 333 333 4455', 'a.ferrari@libero.it',
  'Piazza Campo de'' Fiori, 15 - Int. 2', '00186',
  72, 0, 72,
  2, 5, 2, 1, 0, 2, 1, 1,
  100.00, 14.00, 3.0,
  'Imóvel acima do mercado. Acesso pelo portone verde. Campainha "Ferrari".'
),

-- ── PARTICULAR 4 ── Sofia Conti · Termini
(
  'c3000000-0000-0000-0000-000000000009',
  'Appartamento Termini Business',
  'particular', NULL, 'b2000000-0000-0000-0000-000000000004',
  'Termini Station', '+39 320 444 5566', 'sofia.conti@email.it',
  'Via Marsala, 29 - Int. 8', '00185',
  60, 0, 60,
  1, 4, 1, 2, 0, 1, 2, 0,
  70.00, 10.00, 2.5,
  'Apartamento voltado para clientes de negócios. Sofia pede troca de roupa de cama sempre que > 2 noites.'
),

-- ── PARTICULAR 5 ── Francesco Lombardi · Other areas (EUR)
(
  'c3000000-0000-0000-0000-000000000010',
  'Villa EUR con Piscina',
  'particular', NULL, 'b2000000-0000-0000-0000-000000000005',
  'Other areas', '+39 345 555 6677', 'f.lombardi@outlook.com',
  'Viale dell''Umanesimo, 102', '00144',
  200, 800, 1000,
  2, 12, 5, 4, 1, 4, 4, 3,
  350.00, 30.00, 8.0,
  'Villa com piscina no bairro EUR. Limpeza da área da piscina é OS separada. Cão da raça labrador no local — avisar equipe.'
);
;
