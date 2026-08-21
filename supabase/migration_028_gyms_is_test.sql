-- ⚠️ RECONSTRUIDA: esta migración YA ESTÁ APLICADA en producción.
-- Se aplicó el 2026-07-17 (registrada en supabase_migrations.schema_migrations
-- como "gyms_is_test_flag") pero nunca se había guardado como archivo en el
-- repo. Se reconstruye acá para que el historial versionado coincida con la
-- realidad.

-- Marca "de prueba": el gimnasio se ve en la lista con un cartel PRUEBA pero
-- NO cuenta para la plata (MRR, transferencia, Mercado Pago) ni socios.
alter table public.gyms add column if not exists is_test boolean not null default false;

-- ⛔ NO DESCOMENTAR. Este backfill se corrió UNA vez, el 2026-07-17, cuando
-- todavía no había ningún cliente que pagara y hacía falta que el contador de
-- plata arrancara en cero. Hoy hay clientes reales: volver a correrlo los
-- marcaría a TODOS como prueba y te borraría el MRR del panel.
-- Queda documentado solo para que se entienda por qué los gimnasios viejos
-- tienen is_test = true.
--
--   update public.gyms set is_test = true where is_demo = false;
