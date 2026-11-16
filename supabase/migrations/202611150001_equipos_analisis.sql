-- Órbita · equipos, análisis topográficos y comparaciones guardadas (3FN).
--
-- Se aplica DESPUÉS de 202611140001_catalogo.sql y no modifica sus tablas
-- (fuentes, referencias, sectores), sus datos ni sus políticas: las vistas de
-- Órbita siguen leyendo el catálogo exactamente igual.
--
-- Decisiones de modelo:
-- * Cada hecho se guarda una sola vez. Lo que se deriva de otra columna se
--   calcula en la vista v_analisis_topograficos: zona UTM y hemisferio (de las
--   coordenadas), elevación central, mínima y máxima, desnivel y cobertura
--   (de las muestras DEM) y pendientes en grados (de las pendientes en %).
-- * Las pendientes sí se guardan: son el resultado del método (Horn 3 × 3)
--   tal como lo calculó GeoPendiente en el navegador.
-- * NULL significa «sin dato»; 0 es una medición igual a cero. Ninguna métrica
--   tiene valor por defecto, para que un dato ausente no se convierta en 0.
-- * El identificador del análisis lo genera el cliente y se conserva en la
--   biblioteca local: reintentar el guardado actualiza el mismo registro en
--   vez de duplicarlo.

begin;

-- ---------------------------------------------------------------------------
-- 1. Catálogos de apoyo (lectura pública)
-- ---------------------------------------------------------------------------
create table public.fuentes_dem (
  id text primary key,
  fuente_id text references public.fuentes(id),
  producto text not null,
  proveedor text not null,
  resolucion_nominal_m numeric not null check (resolucion_nominal_m > 0)
);

insert into public.fuentes_dem (id, fuente_id, producto, proveedor, resolucion_nominal_m)
values
  ('copernicus-glo90-open-meteo',
   (select f.id from public.fuentes f where f.id = 'copernicus-glo90'),
   'Copernicus DEM GLO-90', 'Open-Meteo', 90),
  ('srtm-v3-opentopodata', null, 'SRTM v3 (1 arcosegundo)', 'Open Topo Data', 30);

create table public.metodos_pendiente (
  id text primary key,
  nombre text not null,
  descripcion text not null
);

insert into public.metodos_pendiente (id, nombre, descripcion)
values ('horn-3x3', 'Horn 3 × 3',
  'Gradiente de Horn en ventanas 3 × 3. Pendiente local en la celda central; media, mediana, mínima y máxima sobre las ventanas interiores de la cuadrícula.');

-- ---------------------------------------------------------------------------
-- 2. Equipos y miembros
-- ---------------------------------------------------------------------------
create table public.equipos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (char_length(btrim(nombre)) between 2 and 80),
  creado_en timestamptz not null default now()
);

create table public.miembros_equipo (
  equipo_id uuid not null references public.equipos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol text not null default 'miembro' check (rol in ('admin', 'miembro')),
  agregado_en timestamptz not null default now(),
  primary key (equipo_id, usuario_id)
);
create index miembros_equipo_usuario_idx on public.miembros_equipo (usuario_id);

-- ---------------------------------------------------------------------------
-- 3. Análisis topográficos, muestras DEM y comparaciones
-- ---------------------------------------------------------------------------
create table public.analisis_topograficos (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references public.equipos(id) on delete restrict,
  autor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  sector_id text references public.sectores(id),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 100),
  latitud_deg numeric(10, 7) not null check (latitud_deg between -80 and 84),
  longitud_deg numeric(10, 7) not null check (longitud_deg between -180 and 180),
  fuente_dem_id text not null references public.fuentes_dem(id),
  metodo_id text not null references public.metodos_pendiente(id),
  filas smallint not null check (filas between 3 and 50),
  columnas smallint not null check (columnas between 3 and 50),
  espaciado_m numeric not null check (espaciado_m > 0 and espaciado_m <= 100000),
  pendiente_local_pct numeric check (pendiente_local_pct >= 0),
  pendiente_media_pct numeric check (pendiente_media_pct >= 0),
  pendiente_mediana_pct numeric check (pendiente_mediana_pct >= 0),
  pendiente_min_pct numeric check (pendiente_min_pct >= 0),
  pendiente_max_pct numeric check (pendiente_max_pct >= 0),
  -- Azimut de descenso local; NULL cuando el terreno es plano y no hay dirección.
  orientacion_deg numeric check (orientacion_deg >= 0 and orientacion_deg < 360),
  ventanas_horn smallint check (ventanas_horn > 0),
  calculado_en timestamptz not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (pendiente_min_pct is null or pendiente_max_pct is null or pendiente_min_pct <= pendiente_max_pct)
);
create index analisis_equipo_idx on public.analisis_topograficos (equipo_id, actualizado_en desc);
create index analisis_autor_idx on public.analisis_topograficos (autor_id);
create index analisis_sector_idx on public.analisis_topograficos (sector_id);

-- Una fila por celda de la cuadrícula. elevacion_m NULL = celda sin dato.
create table public.muestras_dem (
  analisis_id uuid not null references public.analisis_topograficos(id) on delete cascade,
  fila smallint not null check (fila >= 0),
  columna smallint not null check (columna >= 0),
  elevacion_m numeric,
  primary key (analisis_id, fila, columna)
);

create table public.comparaciones_guardadas (
  id uuid primary key default gen_random_uuid(),
  analisis_id uuid not null references public.analisis_topograficos(id) on delete cascade,
  referencia_id text not null references public.referencias(id),
  creado_en timestamptz not null default now(),
  unique (analisis_id, referencia_id)
);
create index comparaciones_referencia_idx on public.comparaciones_guardadas (referencia_id);

create function public.tocar_actualizado_en() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger analisis_actualizado_en
  before update on public.analisis_topograficos
  for each row execute function public.tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- 4. Pertenencia (security definer: evita la recursión de RLS en miembros)
-- ---------------------------------------------------------------------------
create function public.es_miembro(p_equipo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.miembros_equipo m
    where m.equipo_id = p_equipo and m.usuario_id = (select auth.uid())
  );
$$;

create function public.es_admin_equipo(p_equipo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.miembros_equipo m
    where m.equipo_id = p_equipo and m.usuario_id = (select auth.uid()) and m.rol = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Seguridad a nivel de fila
-- ---------------------------------------------------------------------------
alter table public.fuentes_dem enable row level security;
alter table public.metodos_pendiente enable row level security;
alter table public.equipos enable row level security;
alter table public.miembros_equipo enable row level security;
alter table public.analisis_topograficos enable row level security;
alter table public.muestras_dem enable row level security;
alter table public.comparaciones_guardadas enable row level security;

revoke all on public.fuentes_dem, public.metodos_pendiente, public.equipos,
  public.miembros_equipo, public.analisis_topograficos, public.muestras_dem,
  public.comparaciones_guardadas from anon, authenticated;

grant select on public.fuentes_dem, public.metodos_pendiente to anon, authenticated;
grant select on public.equipos to authenticated;
grant select, insert, update, delete on public.miembros_equipo to authenticated;
grant select, insert, update, delete on public.analisis_topograficos, public.muestras_dem,
  public.comparaciones_guardadas to authenticated;

create policy "Fuentes DEM visibles" on public.fuentes_dem
  for select to anon, authenticated using (true);
create policy "Métodos visibles" on public.metodos_pendiente
  for select to anon, authenticated using (true);

create policy "Equipos propios" on public.equipos
  for select to authenticated using (public.es_miembro(id));

create policy "Miembros del mismo equipo" on public.miembros_equipo
  for select to authenticated using (public.es_miembro(equipo_id));
create policy "Alta solo por administradores" on public.miembros_equipo
  for insert to authenticated with check (public.es_admin_equipo(equipo_id));
create policy "Cambio de rol solo por administradores" on public.miembros_equipo
  for update to authenticated
  using (public.es_admin_equipo(equipo_id)) with check (public.es_admin_equipo(equipo_id));
create policy "Baja solo por administradores" on public.miembros_equipo
  for delete to authenticated using (public.es_admin_equipo(equipo_id));

create policy "Análisis del equipo" on public.analisis_topograficos
  for select to authenticated using (public.es_miembro(equipo_id));
create policy "Crear análisis propio en mi equipo" on public.analisis_topograficos
  for insert to authenticated
  with check (autor_id = (select auth.uid()) and public.es_miembro(equipo_id));
create policy "Editar análisis propio" on public.analisis_topograficos
  for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()) and public.es_miembro(equipo_id));
create policy "Eliminar análisis propio" on public.analisis_topograficos
  for delete to authenticated using (autor_id = (select auth.uid()));

create policy "Muestras del equipo" on public.muestras_dem
  for select to authenticated using (
    exists (select 1 from public.analisis_topograficos a where a.id = analisis_id)
  );
create policy "Muestras del autor" on public.muestras_dem
  for all to authenticated
  using (exists (select 1 from public.analisis_topograficos a
                 where a.id = analisis_id and a.autor_id = (select auth.uid())))
  with check (exists (select 1 from public.analisis_topograficos a
                      where a.id = analisis_id and a.autor_id = (select auth.uid())));

create policy "Comparaciones del equipo" on public.comparaciones_guardadas
  for select to authenticated using (
    exists (select 1 from public.analisis_topograficos a where a.id = analisis_id)
  );
create policy "Comparaciones del autor" on public.comparaciones_guardadas
  for all to authenticated
  using (exists (select 1 from public.analisis_topograficos a
                 where a.id = analisis_id and a.autor_id = (select auth.uid())))
  with check (exists (select 1 from public.analisis_topograficos a
                      where a.id = analisis_id and a.autor_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 6. Vistas con los valores derivados (respetan la RLS de quien consulta)
-- ---------------------------------------------------------------------------
create view public.v_analisis_topograficos with (security_invoker = true) as
select
  a.id, a.equipo_id, a.autor_id, a.sector_id, a.nombre,
  a.latitud_deg, a.longitud_deg,
  least(60, greatest(1, floor((a.longitud_deg + 180) / 6)::int + 1)) as zona_utm,
  case when a.latitud_deg < 0 then 'S' else 'N' end as hemisferio,
  a.fuente_dem_id, d.producto as fuente_producto, d.proveedor as fuente_proveedor,
  d.resolucion_nominal_m, a.metodo_id,
  a.filas, a.columnas, a.espaciado_m,
  (a.columnas - 1) * a.espaciado_m as ancho_m,
  (a.filas - 1) * a.espaciado_m as alto_m,
  m.elevacion_centro_m, m.elev_min_m, m.elev_max_m,
  m.elev_max_m - m.elev_min_m as desnivel_m,
  m.celdas_validas, a.filas * a.columnas as celdas_totales,
  round(100.0 * m.celdas_validas / (a.filas * a.columnas), 2) as cobertura_pct,
  a.pendiente_local_pct, degrees(atan(a.pendiente_local_pct / 100)) as pendiente_local_deg,
  a.pendiente_media_pct, degrees(atan(a.pendiente_media_pct / 100)) as pendiente_media_deg,
  a.pendiente_mediana_pct, degrees(atan(a.pendiente_mediana_pct / 100)) as pendiente_mediana_deg,
  a.pendiente_min_pct, a.pendiente_max_pct,
  a.orientacion_deg, a.ventanas_horn,
  a.calculado_en, a.creado_en, a.actualizado_en
from public.analisis_topograficos a
join public.fuentes_dem d on d.id = a.fuente_dem_id
left join lateral (
  select
    count(s.elevacion_m)::int as celdas_validas,
    min(s.elevacion_m) as elev_min_m,
    max(s.elevacion_m) as elev_max_m,
    max(s.elevacion_m) filter (where s.fila = a.filas / 2 and s.columna = a.columnas / 2) as elevacion_centro_m
  from public.muestras_dem s
  where s.analisis_id = a.id
) m on true;

-- Comparación guardada frente a la referencia planetaria (diferencias derivadas).
create view public.v_comparaciones_guardadas with (security_invoker = true) as
select
  c.id, c.analisis_id, c.referencia_id, r.mision, r.nombre as referencia_nombre,
  v.pendiente_mediana_deg,
  r.pendiente_mediana_deg as referencia_pendiente_mediana_deg,
  abs(v.pendiente_mediana_deg - r.pendiente_mediana_deg) as diferencia_pendiente_deg,
  v.desnivel_m,
  r.desnivel_m as referencia_desnivel_m,
  abs(v.desnivel_m - r.desnivel_m) as diferencia_desnivel_m,
  c.creado_en
from public.comparaciones_guardadas c
join public.v_analisis_topograficos v on v.id = c.analisis_id
join public.referencias r on r.id = c.referencia_id;

grant select on public.v_analisis_topograficos, public.v_comparaciones_guardadas to authenticated;
revoke all on public.v_analisis_topograficos, public.v_comparaciones_guardadas from anon;

-- ---------------------------------------------------------------------------
-- 7. Guardado atómico e idempotente (se ejecuta con los permisos de quien llama)
-- ---------------------------------------------------------------------------
create function public.guardar_analisis(
  p_analisis jsonb,
  p_muestras jsonb,
  p_referencias text[] default '{}'
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_filas int := (p_analisis->>'filas')::int;
  v_columnas int := (p_analisis->>'columnas')::int;
  v_total int;
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para guardar en la nube.' using errcode = '28000';
  end if;
  if jsonb_typeof(p_muestras) is distinct from 'array' then
    raise exception 'Faltan las muestras DEM.' using errcode = '22023';
  end if;

  insert into public.analisis_topograficos as a (
    id, equipo_id, autor_id, sector_id, nombre, latitud_deg, longitud_deg,
    fuente_dem_id, metodo_id, filas, columnas, espaciado_m,
    pendiente_local_pct, pendiente_media_pct, pendiente_mediana_pct,
    pendiente_min_pct, pendiente_max_pct, orientacion_deg, ventanas_horn, calculado_en
  ) values (
    coalesce((p_analisis->>'id')::uuid, gen_random_uuid()),
    (p_analisis->>'equipo_id')::uuid,
    (select auth.uid()),
    nullif(p_analisis->>'sector_id', ''),
    p_analisis->>'nombre',
    (p_analisis->>'latitud_deg')::numeric,
    (p_analisis->>'longitud_deg')::numeric,
    p_analisis->>'fuente_dem_id',
    p_analisis->>'metodo_id',
    v_filas, v_columnas,
    (p_analisis->>'espaciado_m')::numeric,
    (p_analisis->>'pendiente_local_pct')::numeric,
    (p_analisis->>'pendiente_media_pct')::numeric,
    (p_analisis->>'pendiente_mediana_pct')::numeric,
    (p_analisis->>'pendiente_min_pct')::numeric,
    (p_analisis->>'pendiente_max_pct')::numeric,
    (p_analisis->>'orientacion_deg')::numeric,
    (p_analisis->>'ventanas_horn')::smallint,
    coalesce((p_analisis->>'calculado_en')::timestamptz, now())
  )
  on conflict (id) do update set
    equipo_id = excluded.equipo_id,
    sector_id = excluded.sector_id,
    nombre = excluded.nombre,
    latitud_deg = excluded.latitud_deg,
    longitud_deg = excluded.longitud_deg,
    fuente_dem_id = excluded.fuente_dem_id,
    metodo_id = excluded.metodo_id,
    filas = excluded.filas,
    columnas = excluded.columnas,
    espaciado_m = excluded.espaciado_m,
    pendiente_local_pct = excluded.pendiente_local_pct,
    pendiente_media_pct = excluded.pendiente_media_pct,
    pendiente_mediana_pct = excluded.pendiente_mediana_pct,
    pendiente_min_pct = excluded.pendiente_min_pct,
    pendiente_max_pct = excluded.pendiente_max_pct,
    orientacion_deg = excluded.orientacion_deg,
    ventanas_horn = excluded.ventanas_horn,
    calculado_en = excluded.calculado_en
  returning a.id into v_id;

  -- Las muestras se reemplazan completas: la cuadrícula guardada es siempre la última calculada.
  delete from public.muestras_dem where analisis_id = v_id;
  insert into public.muestras_dem (analisis_id, fila, columna, elevacion_m)
  select v_id, x.fila, x.columna, x.elevacion_m
  from jsonb_to_recordset(p_muestras) as x(fila smallint, columna smallint, elevacion_m numeric);
  get diagnostics v_total = row_count;
  if v_total <> v_filas * v_columnas
     or exists (select 1 from public.muestras_dem s
                where s.analisis_id = v_id and (s.fila >= v_filas or s.columna >= v_columnas)) then
    raise exception 'La cuadrícula debe tener % × % muestras con índices válidos.', v_filas, v_columnas
      using errcode = '22023';
  end if;

  delete from public.comparaciones_guardadas
  where analisis_id = v_id and not (referencia_id = any (coalesce(p_referencias, '{}')));
  insert into public.comparaciones_guardadas (analisis_id, referencia_id)
  select v_id, r from unnest(coalesce(p_referencias, '{}')) as r
  on conflict (analisis_id, referencia_id) do nothing;

  return v_id;
end;
$$;

-- Alta de miembros por correo: solo un administrador del equipo.
create function public.agregar_miembro(p_equipo uuid, p_email text, p_rol text default 'miembro')
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid;
begin
  if not public.es_admin_equipo(p_equipo) then
    raise exception 'Solo un administrador del equipo puede agregar miembros.' using errcode = '42501';
  end if;
  if p_rol not in ('admin', 'miembro') then
    raise exception 'Rol no válido.' using errcode = '22023';
  end if;
  select u.id into v_usuario from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_usuario is null then
    raise exception 'No hay una cuenta registrada con ese correo.' using errcode = 'P0002';
  end if;
  insert into public.miembros_equipo (equipo_id, usuario_id, rol)
  values (p_equipo, v_usuario, p_rol)
  on conflict (equipo_id, usuario_id) do update set rol = excluded.rol;
end;
$$;

revoke execute on function public.es_miembro(uuid), public.es_admin_equipo(uuid),
  public.guardar_analisis(jsonb, jsonb, text[]), public.agregar_miembro(uuid, text, text),
  public.tocar_actualizado_en() from public, anon;
grant execute on function public.es_miembro(uuid), public.es_admin_equipo(uuid),
  public.guardar_analisis(jsonb, jsonb, text[]), public.agregar_miembro(uuid, text, text)
  to authenticated;

commit;
