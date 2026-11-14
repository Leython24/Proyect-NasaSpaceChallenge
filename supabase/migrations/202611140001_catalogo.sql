begin;

create table public.fuentes (
  id text primary key,
  institucion text not null,
  producto text not null,
  url text not null check (url ~ '^https?://'),
  resolucion text,
  uso text,
  publicado boolean not null default false
);

create table public.referencias (
  id text primary key,
  mision text not null check (mision in ('marte','luna')),
  nombre text not null,
  fuente_id text references public.fuentes(id),
  pendiente_mediana_deg numeric check (pendiente_mediana_deg between 0 and 90),
  area_suave_pct numeric check (area_suave_pct between 0 and 100),
  desnivel_m numeric check (desnivel_m >= 0),
  resolucion_analisis_m numeric check (resolucion_analisis_m > 0),
  publicado boolean not null default false,
  unique (id, mision)
);

create table public.sectores (
  id text primary key,
  mision text not null,
  referencia_id text not null,
  nombre text not null,
  departamento text not null,
  geometria jsonb not null check (
    jsonb_typeof(geometria) = 'object' and geometria ? 'type'
    and geometria->>'type' in ('Polygon','MultiPolygon')
    and geometria ? 'coordinates' and jsonb_typeof(geometria->'coordinates') = 'array'
  ),
  fuente_id text references public.fuentes(id),
  pendiente_mediana_deg numeric check (pendiente_mediana_deg between 0 and 90),
  area_suave_pct numeric check (area_suave_pct between 0 and 100),
  desnivel_m numeric check (desnivel_m >= 0),
  cobertura_pct numeric check (cobertura_pct between 0 and 100),
  resolucion_analisis_m numeric check (resolucion_analisis_m > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente','medido','validado')),
  ensayo text,
  similitud text,
  limites text,
  publicado boolean not null default false,
  foreign key (referencia_id, mision) references public.referencias(id, mision)
);

alter table public.fuentes enable row level security;
alter table public.referencias enable row level security;
alter table public.sectores enable row level security;

revoke all on public.fuentes, public.referencias, public.sectores from anon, authenticated;
grant select on public.fuentes, public.referencias, public.sectores to anon, authenticated;

create policy "Fuentes publicadas" on public.fuentes for select to anon, authenticated using (publicado);
create policy "Referencias publicadas" on public.referencias for select to anon, authenticated using (publicado);
create policy "Sectores publicados" on public.sectores for select to anon, authenticated using (
  publicado and exists (select 1 from public.referencias r where r.id = referencia_id and r.publicado)
);
commit;
