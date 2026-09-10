alter table public.empresas
  add column if not exists licitaciones_palabras_clave text[] not null
  default array[
    'panadería',
    'pastelería',
    'repostería',
    'productos de panadería',
    'productos de pastelería',
    'pan amasado',
    'tortas'
  ]::text[];

comment on column public.empresas.licitaciones_palabras_clave is
  'Palabras o frases que deben coincidir para incluir una licitación en el agente de oportunidades.';
