-- Importacion generada desde Clientes.xls el 2026-06-24.
-- 145 clientes unicos y 176 precios especiales por cliente.
-- La columna EMPANADA DE PINO contenia 18 en todas las filas y se omitio por no ser un precio valido.

begin;

alter table public.clientes
  add column if not exists codigo_legacy text,
  add column if not exists sigla text,
  add column if not exists repartidor_nombre text,
  add column if not exists forma_pago text,
  add column if not exists plazo_pago text,
  add column if not exists precio_base numeric;

create table if not exists public.cliente_producto_precios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  producto_id bigint not null references public.productos(id) on delete cascade,
  precio numeric not null check (precio >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, producto_id)
);

alter table public.cliente_producto_precios enable row level security;
drop policy if exists "precios_cliente_empresa" on public.cliente_producto_precios;
create policy "precios_cliente_empresa"
on public.cliente_producto_precios
for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop trigger if exists cliente_producto_precios_updated_at on public.cliente_producto_precios;
create trigger cliente_producto_precios_updated_at
before update on public.cliente_producto_precios
for each row execute function public.actualizar_updated_at();

do $$
declare
  v_empresa uuid;
begin
  select id into v_empresa
  from public.empresas
  where slug = 'maruxa' and activo = true
  order by created_at
  limit 1;

  if v_empresa is null then
    raise exception 'No se encontro la empresa activa con slug maruxa';
  end if;

  if not exists (
    select 1 from public.productos
    where empresa_id = v_empresa and upper(trim(nombre)) = 'PAN CORRIENTE'
  ) then
    insert into public.productos (
      empresa_id, codigo, nombre, descripcion, precio, categoria, slug,
      tipo_producto, unidad_base, costo_unitario, stock_actual, stock_minimo,
      iva_porcentaje, activo, controla_stock, destacado
    ) values (
      v_empresa, 'PAN-CORRIENTE', 'PAN CORRIENTE',
      'Producto importado desde el listado historico de clientes',
      0, 'Panaderia', 'pan-corriente', 'producto', 'unidad', 0, 0, 0, 19, true, true, false
    );
  end if;

  if not exists (
    select 1 from public.productos
    where empresa_id = v_empresa and upper(trim(nombre)) = 'PAN ESPECIAL'
  ) then
    insert into public.productos (
      empresa_id, codigo, nombre, descripcion, precio, categoria, slug,
      tipo_producto, unidad_base, costo_unitario, stock_actual, stock_minimo,
      iva_porcentaje, activo, controla_stock, destacado
    ) values (
      v_empresa, 'PAN-ESPECIAL', 'PAN ESPECIAL',
      'Producto importado desde el listado historico de clientes',
      0, 'Panaderia', 'pan-especial', 'producto', 'unidad', 0, 0, 0, 19, true, true, false
    );
  end if;

  if not exists (
    select 1 from public.productos
    where empresa_id = v_empresa and upper(trim(nombre)) = 'EMPANADA DE PINO'
  ) then
    insert into public.productos (
      empresa_id, codigo, nombre, descripcion, precio, categoria, slug,
      tipo_producto, unidad_base, costo_unitario, stock_actual, stock_minimo,
      iva_porcentaje, activo, controla_stock, destacado
    ) values (
      v_empresa, 'EMP-PINO', 'EMPANADA DE PINO',
      'Producto importado sin precio: la planilla contenia el valor residual 18',
      0, 'Empanadas', 'empanada-de-pino', 'producto', 'unidad', 0, 0, 0, 19, true, true, false
    );
  end if;

  insert into public.clientes (
    empresa_id, rut, razon_social, giro, direccion, comuna, ciudad, email, telefono, activo,
    codigo_legacy, sigla, repartidor_nombre, forma_pago, plazo_pago, precio_base
  ) values
    (v_empresa, '78234160-K', 'A Punto Servicios de Alimentos S.A', 'Alimentación', 'Teniente Bisson Nª740', 'Independencia', 'Santiago', null, '950219660', true, '99', 'A Punto', 'Panaderia Maruxa', null, 'CREDITO', null),
    (v_empresa, '76659512-K', 'Abarrotes Juan Hidalgo Tejeda EIRL', 'Abarrotes', 'Pje. Santos. (Pob. Brasilia) N° 5685', 'San Miguel', 'Santiago', null, null, true, null, 'Juan H', 'Luis Albornoz', null, 'CREDITO', 1000),
    (v_empresa, '12491022-6', 'Alejandro Ernesto Altamirano Pinto', 'Almacen', 'Carlos Walker Martinez Nº 5940', 'San Miguel', 'Santiago', null, null, true, '9', 'Alejandro', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1300),
    (v_empresa, '16912435-3', 'Alejandro Francisco Del Pino Carrasco', 'Almacen', 'Avda. Departamental N° 352', 'San Joaquin', 'Santiago', null, '+56 9 58628249', false, null, 'Alejandro', 'Juan Sanchez', null, 'CREDITO', 900),
    (v_empresa, '6873088-0', 'Alfonso Eduardo Gallardo Lopetegui', 'Carnicería', 'Sebastopol N° 442-B', 'San Joaquin', 'Santiago', null, null, true, '8', 'Alfonso', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1100),
    (v_empresa, '76235782-8', 'ALIMENTOS ALISUR LIMITADA', 'CASINO', 'SEBASTOPOL N° 636', 'SAN MIGUEL', 'SANTIAGO', null, '73332154', true, '88', 'ALISUR', 'Panaderia Maruxa', null, 'CREDITO', null),
    (v_empresa, '76029743-7', 'Alvi Supermercado Mayorista S.A', 'Grandes Establecimientos (Venta de Alimentos)', 'Cerro El Plomo N° 5680 Piso 11', 'XIII', 'Santiago', 'recepcion@custodium.com', '28188462', true, '100', 'Alvi', 'Panaderia Maruxa', 'TRANSFERENCIA', 'CREDITO', 2400),
    (v_empresa, '7317305-1', 'Amanda Susana Roig Carrizo', 'Almacen - Minimarket', 'Varas Mena N° 452', 'San Joaquin', 'Santiago', null, '22459037', true, '71', 'Priscila', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '4525258-2', 'Ana Luisa Herrera Cabello', 'Almacen', 'José Ananías F. Nº 651', 'Macul', 'Santiago', null, null, true, '104', 'Ana Luisa', 'Panaderia Maruxa', null, null, 1700),
    (v_empresa, '77343454-9', 'Animal FoodTruck Angelo Lvarez Garca EIRL', 'Venta por menor de Alim.', 'Dos Oriente Nº 8602', 'La Cisterna', 'Santiago', null, '+56 9 8159 5124', true, '15', 'Felipe', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1300),
    (v_empresa, '13298854-4', 'Antonio Rodriguez', 'Almacen', 'Pintor Durero N° 5635', 'San Joaquin', 'Santiago', null, null, true, '7', 'Antonio', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '5813439-2', 'Berta Patricia Espinoza Velasquez', 'Minimarket', 'Av. Santa Rosa N° 5857', 'San Miguel', 'Santiago', null, '225116782', true, null, 'Berta', 'Luis Albornoz', null, 'CREDITO', 1800),
    (v_empresa, '8042001-3', 'Bessie Nelly Soza Sanchez', 'Carniceria', 'Tannenbaun 523', 'San Miguel', 'Santiago', null, '5117856', true, '22', 'Bessie', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '6463363-5', 'Betsabe del Carmen Aguayo Oliveros', 'Abarrotes-Carnicería', 'Santa Clara Nº 5715', 'San Miguel', 'Santiago', null, '5268361', true, '54', 'Betzabe', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1200),
    (v_empresa, '17053359-3', 'Carmen Gloria Muñoz Valencia', 'Almacen', 'Carmen Mena N° 977', 'San Miguel', 'Santiago', null, '224019457', true, '6', 'Carmen', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1000),
    (v_empresa, '15888481-K', 'Carmen Gloria Orellana Salazar', 'Confiteria', 'Pentagrama N° 412-A', 'San Joaquin', 'Santiago', null, null, true, null, 'Carmen', 'Juan Sanchez', null, 'CREDITO', 1800),
    (v_empresa, '16222260-0', 'Carmen Gloria Reyes Martinez', 'Almacen', 'Vargas Buston 538', 'SIN COMUNA', 'Santiago', null, null, true, '61', 'Carmen G', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '15464155-6', 'Carolina Elizabeth Valdivia Suarez', 'Almacen', 'Sebastopol 387', 'SIN COMUNA', 'Santiago', null, null, true, '59', 'Carolina', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '15544902-0', 'Carolina Sanchez', 'Almacen', 'Varas Mena N° 763', 'San Miguel', 'Santiago', null, null, true, '2', 'Carolina', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '12902511-5', 'Catherine cerda', 'Cafetería', 'Pedro Mira N° 615', 'sin comuna', 'santiago', null, '+56 9 8189 5332', true, '136', 'Catherine', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '13938306-0', 'Cecilia Del Carmen Cortes Ortega', 'Almacen', 'Oscar Castro N° 396', 'San Joaquín', 'Santiago', null, null, true, '81', 'Cecilia', 'Luis Albornoz', null, 'CREDITO', 1900),
    (v_empresa, '23277642-0', 'Cesar Augusto Paredes Abanto', 'Almacen', 'Varas Mena Nº 812', 'San Miguel', 'Santiago', null, null, true, '19', 'Cesar', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1800),
    (v_empresa, '66666666-6', 'CLIENTE BOLETA', 'FABRICACION DE PAN', 'SANTA ROSA 6019', 'SAN MIGUEL', 'SANTIAGO', null, null, true, '2000', 'BOLETAS', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '77268161-5', 'Comercial Díaz Ramirez SPA', 'Minimarket', 'Sebastopol Nº 388', 'San Joaquin', 'Santiago', null, null, true, null, 'José', 'Luis Albornoz', null, 'CREDITO', 1700),
    (v_empresa, '77258036-3', 'Comercial Las Patatas SPA', 'Vta alimentos envasados.', 'Varas Mena N° 436', 'San Joaquín', 'Santiago', null, null, true, null, 'Las Patatas', 'Luis Albornoz', null, 'CREDITO', 1800),
    (v_empresa, '77143442-8', 'Comercial Marcelo Saul Cordova', 'Almacen', 'Calle Berman Nº 570', 'San Miguel', 'Santiago', null, null, true, '123', 'Marcelo', 'Juan Sanchez', null, null, 1900),
    (v_empresa, '76393220-6', 'Comercial san sebastian', 'Carnicería, Botillería, Almacen', 'Sebastopol N°596', 'San Miguel', 'Santiago', null, null, true, null, 'SEBASTIAN', 'Juan Sanchez', null, null, 1900),
    (v_empresa, '77315052-4', 'Comercializadora Catatumbo SPA', 'Almacen', 'Carmen Mena Nº 998, Local 1', 'San Joaquin', 'Santiago', null, null, true, '111', 'Catatumbo', 'Panaderia Maruxa', null, null, 1800),
    (v_empresa, '76904885-5', 'Comercializadora Diego Farias Arriaza SPA', 'Almacen', '5TA Avenida N° 1407', 'San Miguel', 'Santiago', null, null, true, '133', 'DIEGO', 'Luis Albornoz', null, null, 1900),
    (v_empresa, '77232653-K', 'Comercializadora Divina Pastora Spa', 'Almacen', 'Varas Mena Nº 661, Local B', 'San Miguel', 'Santiago', null, null, false, null, 'Pastora', 'Juan Sanchez', null, 'CREDITO', 950),
    (v_empresa, '19844794-3', 'Constanza Javiera Astorga Bastias', 'ALMACEN', 'Pintor Durero Nº 563-A', 'San Joaquín', 'SANTIAGO', null, '981788870', true, null, 'Constanza', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '76730092-1', 'Constructora STP Limitada', 'Constructora', 'Moneda N°812', 'Santiago', 'Santiago', null, null, true, '146', 'Constructora', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '96721520-1', 'Constructora Terra S.A', 'Constructora', 'Av. La Dehesa Nº 181 1002', 'Lo Barnechea', 'Santiago', null, null, true, '122', 'Constructora', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '70962500-4', 'CORP MUNICIPAL DE SAN MIGUEL', 'EDUCACIÓN', 'LLANO SUBERCASDEAUX 3519', 'SAN MIGUEL', 'SANTIAGO', null, null, true, '98', 'CORP', 'Panaderia Maruxa', null, 'CREDITO', null),
    (v_empresa, '12743718-1', 'Dagoberto Hernan Curilef', 'Almacen', 'Sta Clara 6091', 'SIN COMUNA', 'Santiago', null, '24019418', true, '20', 'Dagoberto', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '11268963-K', 'Dagoberto Leonel Diaz Correa', 'Almacen - Carnicer?a', 'Esmeralda N? 5570', 'SIN COMUNA', 'Santiago', null, null, false, '75', 'Dagoberto L', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 950),
    (v_empresa, '12684163-9', 'Dalia Canales', 'almacen', 'Varas mena Nº 535', 'san miguel', 'santiago', null, null, true, null, 'Dalia', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '76840502-6', 'Dilun Limitada', 'Platos Preparados', 'Pero Nº 8866', 'La Cisterna', 'Santiago', null, null, true, '115', 'Dilun', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '77866852-1', 'Distribuidora Garcia Limitada', 'Almacen', 'Manquehue Sur Nº 520, Oficina 205', 'Las Condes', 'Santiago', null, '991996454', true, '126', 'Dist. Garcia', 'Luis Albornoz', null, null, 1800),
    (v_empresa, '6346761-8', 'Dominga del Carmen Caris Perez', 'Almacen', 'Varas Mena N° 389', 'San Joaquin', 'Santiago', null, null, true, null, 'Dominga', 'Luis Albornoz', null, 'CREDITO', 1950),
    (v_empresa, '78294273-5', 'Donde Alicia y Fidel', 'Almacen', 'Santa Fe N° 744', 'San Miguel', 'Santiago', null, null, true, '144', 'Alicia y Fidel', 'Juan Sanchez', null, null, 1900),
    (v_empresa, '10179365-6', 'Edith Jacqueline Zuniga Jaramillo', 'Almacen', 'Sebastopol Nº 335', 'San Joaquin', 'Santiago', null, null, true, '108', 'Edith', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '11887470-6', 'Eliana del Carmen Reveco Córdova', 'Serv. Banquete', 'Santa Fe 572', 'San Miguel', 'Santiago', 'elsabordecasa127@gmail.com', '08 2497934', false, '26', 'Eliana R.', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1000),
    (v_empresa, '11885589-2', 'Elizabeth Bucarey. U', 'Almacen', 'Pje. Carlos Pezoa 5773', 'SIN COMUNA', 'Santiago', null, null, true, '57', 'Elizabeht', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '7702877-3', 'Elizabeth Lidia Gajardo Salinas', 'Almacén', 'Carmen Mena N°684', 'San Miguel', 'Santiago', null, '995415138', true, null, 'Eli. Lidia', 'Luis Albornoz', null, 'CREDITO', 1900),
    (v_empresa, '16243444-6', 'Elizabeth Soledad Vidal Sanhueza', 'Almacen', 'Centenario 969', 'San Miguel', 'Santiago', null, '26096622', false, '23', 'Elizabeth S', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1500),
    (v_empresa, '5129602-8', 'Elsa Sepulveda', 'Almacen', 'Juan Plana N° 5741', 'San Joaquin', 'Santiago', null, '5263978', true, '10', 'Elsa', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '14204795-0', 'EMILIO SALAS FLORES', 'PARTICULAR', 'SITIO 21. EL NARANJAL', 'SAN VICENTE DE T.', 'SAN VICENTE DE T.', 'emilio.salasf@gmail.com', '+56 921150100', true, '137', 'EMILIO', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '77685345-3', 'Erika Luz Marchan Ossa', 'Almacen', 'Calle Berman Nº 570', 'San Miguel', 'Santiago', null, null, true, '119', 'Erika', 'Luis Albornoz', null, null, null),
    (v_empresa, '15888361-9', 'Evelyn Alejandra Pinto Orellana', 'Almacén', 'Juan Aravena Nº 415', 'San Joaquín', 'Santiago', null, null, true, null, 'Evelyn', 'Luis Albornoz', null, 'CREDITO', 1900),
    (v_empresa, '11255161-1', 'Fabiola Cañas', 'Almacen', 'Varas Mena N° 509', 'San Miguel', 'Santiago', null, null, true, '13', 'Fabiola C', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 2000),
    (v_empresa, '77006924-6', 'Fernando Quezada Navarro', 'Almacen', 'Varas Mena N°965', 'San Miguel', 'Santiago', null, null, false, '97', 'Fernando', 'Juan Sanchez', null, 'CREDITO', 1200),
    (v_empresa, '16817532-9', 'Francisco Jesús Valenzuela Muñoz', 'Minimarket', 'Av. Varas Mena N° 443, Villa Juan Plana', 'San Joaquín', 'Santiago', null, null, false, '91', 'Francisco', 'Juan Sanchez', null, 'CREDITO', 1000),
    (v_empresa, '76414289-6', 'Fruit & Green Spa', 'Compra y Venta de Fr', 'Vargas Buston 906', 'SIN COMUNA', 'Santiago', null, null, true, '17', 'Fruit', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '77412593-0', 'Frutissimo spa', 'Almacen', 'Carmen Mena N° 998', 'San Miguel', 'Santiago', null, null, true, null, 'FRUTISIMO', 'Juan Sanchez', null, null, 1800),
    (v_empresa, '16042368-4', 'Gaston Orlando Salgado Rojas', 'Almacen', 'Pompeya N? 325', 'San Joaquin', 'Santiago', null, '28910407', true, '72', 'Gaston', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1950),
    (v_empresa, '12509986-6', 'Giovanna Salgado', 'Almacen', 'Carlos Peszoa 5761', 'San Joaquin', 'Santiago', null, null, true, '16', 'Giovanna', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '77654134-6', 'Grean SPA', 'Almacen', 'Ipiranga Nº 5694', 'San Miguel', 'Santiago', null, null, true, '130', 'Grean', 'Luis Albornoz', null, null, 1900),
    (v_empresa, '11360363-1', 'Guiselle V. Godoy Campos', 'Librería,Bazar', 'Varas Mena N° 446', 'San Joaquín', 'Santiago', null, '983400403', true, '89', 'Guiselle', 'Panaderia Maruxa', null, 'CREDITO', 1000),
    (v_empresa, '8458416-9', 'Gumaro Arturo Torruella Mariangel', 'Venta al por menor', 'José Ghiardo N° 098', 'La Granja', 'Santiago', null, null, true, null, 'ARTURO', 'Luis Albornoz', null, null, 1900),
    (v_empresa, '9343789-6', 'HAYDEE RAMONA ARRATIA CÁRCAMO', 'Particular', 'Av. Carlos Alessandri 1666, depto 306', 'Algarrobo', 'Algarrobo', 'anita271@hotmail.com', null, true, '103', 'Haydee', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '7253082-9', 'Hector Enrique Rabanales Macaya', 'Artículos de Aseo', 'Santa Fe N° 615', 'San Miguel', 'Santiago', null, '225269167', false, '96', 'Hector E.', 'Juan Sanchez', null, 'CREDITO', 1200),
    (v_empresa, '9588132-7', 'Hilda Julia Diaz Daza', 'Almacen', 'Vargas Buston 622', 'San Miguel', 'Santiago', null, '25112736', true, '56', 'Hilda', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1850),
    (v_empresa, '79998040-1', 'Indupan Servicios Limitada', 'Comercial', 'Av. Marin 0559', 'PROVIDENCIA', 'Santiago', null, null, true, '86', 'Indupan', 'Panaderia Maruxa', 'EFECTIVO', 'CREDITO', 1200),
    (v_empresa, '77427069-8', 'Ingrid Valdes Tobar', 'Almacen', 'Chiloe Nº 5779', 'San Miguel', 'Santiago', null, '87227286', true, '12', 'Ingrid', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1800),
    (v_empresa, '76614541-8', 'Inversiones Rodríguez León Limitada', 'Venta de Alimentos.', 'Carmen Mena N° 621', 'San Miguel', 'Santiago', null, '+569 7706 4771', true, '69', 'Daniel', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1050),
    (v_empresa, '14460080-0', 'Isaac Abraham Garcia Guerrero', 'Almacen.', 'Benozzo Gozzoli N° 5596.', 'San Joaquin', 'Santiago', null, null, true, '58', 'Isaac', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '6263716-1', 'Isabel Medel', 'Almacen', 'Santa Fe N? 714', 'SIN COMUNA', 'Santiago', null, null, true, '70', 'Isabel M', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '77214448-2', 'Jessica Andrea Silva Maldini', 'Pasteleria', 'Santa Clara Nº 5781', 'San Mieguel', 'Santiago', null, null, true, '110', 'Jessica', 'Luis Albornoz', null, null, 1900),
    (v_empresa, '6061001-0', 'Jorge Ricardo Henriquez Mendoza', 'Almacen - Bazar', 'Libertador Nº 6828, Villa Brazil', 'La Granja', 'Santiago', 'jorgehenriquezmendoza@gmail.com', '225110872', true, '101', 'Simon', 'Luis Albornoz', null, null, 1200),
    (v_empresa, '10463944-5', 'José Aravena', 'Almacen', 'Varas Mena Nº 535', 'San Miguel', 'Santiago', null, '982500683', true, '117', 'José', 'Luis Albornoz', null, null, null),
    (v_empresa, '81989400-0', 'JOSE RODRIGUEZ ALVARADO Y CIA LTDA', 'PANADERIA', 'Av. Santa Rosa 6019', 'San Miguel', 'SANTIAGO', 'mabcontax@gmail.com', '998428324', true, '129', 'Don José', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '16451545-1', 'JUAN AGUSTIN ISAIAS ARAVENA ORTEGA', 'Almacen', 'Juan Planas Nº 6088', 'San Joaquin', 'Santiago', null, null, true, null, 'Donde Juan', 'Luis Albornoz', null, null, 1800),
    (v_empresa, '7890517-4', 'Juan Benjamin Villaroel Tapia', 'Almacen', 'Pje Blanco N° 5598 Depto 102', 'San Miguel', 'Santiago', null, null, true, '14', 'Juan', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1800),
    (v_empresa, '12791373-0', 'Juana De La Cruz Urrutia Torres', 'almacen', 'Jose Ghiardo 0163', 'San Joaquin', 'Santiago', null, null, true, '50', 'Juana', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '25561963-2', 'Julienne Exat', 'ALMACEN', 'La Castrina Nº 427', 'San Joaquín', 'Santiago', null, null, true, null, 'Julienne', 'Juan Sanchez', null, null, 1800),
    (v_empresa, '13415596-5', 'Karina del Carmen Pinto Azocar', 'MiniMarket', 'Varas Mena Nº 489', 'San Joaquín', 'Santiago', null, null, true, '62', 'Karina', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1800),
    (v_empresa, '77991198-5', 'Karina Ester Pulgar Figueroa', 'Almacén', 'Vecinal N° 6119', 'San Joaquín', 'Santiago', null, null, true, null, 'KARINA', 'Juan Sanchez', null, null, 1900),
    (v_empresa, '27653622-2', 'Kateryn Johanna Castaño Reina', 'Almacen', 'Av. Santa Rosa Nº 5881', 'San Miguel', 'Santiago', null, null, true, '132', 'Kateryn', 'Juan Sanchez', null, null, null),
    (v_empresa, '13494706-3', 'Katherine Hernández Jorquera', 'Almacen', 'Moscú Nº 6044', 'San Miguel', 'Santiago', null, '+56 9 5371 3041', true, '110', 'Katherine', 'Luis Albornoz', null, null, null),
    (v_empresa, '15340717-7', 'Khaterina Del Carmen Gomez Hernandez', 'Almacen', 'Varas Mena N? 352', 'San Joaquin', 'Santiago', null, null, false, '80', 'Katherina', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 950),
    (v_empresa, '77931532-0', 'La Nonna Fast Food SPA', 'Comida Rápida', 'Ureta Cox N°415, Local H.', 'San Joaquín', 'Santiago', 'pablo.mortara@apro.cl', null, true, null, 'La Nonna', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '77434418-7', 'Las Espigas SPA', 'Almacen', 'Las Industrias Nº 6193', 'San Joaquín', 'Santiago', null, null, true, '125', 'Las Espigas', 'Luis Albornoz', null, null, 1900),
    (v_empresa, '76835983-0', 'Leon Ferrada Compañia limitada', 'Almacen', 'C.M Pasaje 3 N° 6007', 'San Miguel', 'Santiago', null, null, false, '85', 'Leon', 'Juan Sanchez', null, 'CREDITO', 1000),
    (v_empresa, '7013679-1', 'Leontina Del Transito Perez Arancibia', 'Almacen', 'Pacochan N?6057', 'San Miguel', 'Santiago', null, '86420689', true, '81', 'Leontina', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1800),
    (v_empresa, '16040454-K', 'Leslye Carrasco', 'Almacen', 'Pje. Oscar Naranjo N? 555', 'SIN COMUNA', 'Santiago', null, null, true, '76', 'Leslye', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '16042698-5', 'Lissette Del Carmen Retamales Zapata', 'Almacen', 'Macaroff N?6255', 'SIN COMUNA', 'Santiago', null, '25258879', true, '65', 'Lissette', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '23441690-1', 'Luis Enrique Garcia Muñoz', 'Almacen', 'Carmen Mena 684', 'SIN COMUNA', 'Santiago', null, null, true, '51', 'Omar', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '9480478-7', 'Luis Humberto Miranda Cortez', 'Almacen', 'Arturo Pardo N° 445', 'San Joaquin', 'Santiago', null, null, true, '11', 'Luis H', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '9877560-9', 'Maggi Andrea Fuentes Avello', 'MniMarket', 'Av. Centenario Nº 969 LT 15', 'San Miguel', 'Santiago', null, null, true, '24', 'Maggi', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '12640961-3', 'Marcela del Carmen Parada Romero', 'Almacen', 'Sexta Avenida, Nº 1124', 'San Miguel', 'Santiago', null, null, true, '52', 'Marcela', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '11486324-6', 'Marcelo Hipolito Frau Angulo', 'Panadería', 'Varas Mena Nº 705', 'San Miguel', 'Santiago', null, null, true, '106', 'Marcelo', 'Juan Sanchez', null, null, null),
    (v_empresa, '9117887-7', 'Maria Angélica Maulen Gonzalez', 'Almacen', 'Sebastopol 707', 'SIN COMUNA', 'Santiago', null, null, true, '21', 'Maria A', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '9484447-9', 'Maria Cecilia Aravena Brizuela', 'Almacen', 'Pje. Pablo de Rocka N? 580', 'San Miguel', 'Santiago', null, null, true, '64', 'Maria C', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '13426235-4', 'María Elizabeth Ramos Quezada', 'Conceción de Casinos', 'Carmen Mena Nº 728', 'San Miguel', 'Santiago', null, '962705143', true, '130', 'Casino', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '5438955-8', 'Maria Isabel Calderon', 'Almacen', 'Lo Ovalle N° 0049', 'La Granja', 'Santiago', null, '5253367', true, '1', 'Isabel', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '9879370-4', 'María Isabel Chandía Chandía', 'Almacén-Bazar', 'Ingeniero Mario Diaz N° 334, Población las Industrias', 'San Joaquín', 'Santiago', null, '223131896', true, '84', 'Chandía', 'Juan Sanchez', null, 'CREDITO', 1900),
    (v_empresa, '7206136-5', 'Marina del Carmen Dinamarca Canales', 'Almacen', 'Flaminio  330', 'San Joaqu?n', 'Santiago', null, null, true, '53', 'Marina', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 950),
    (v_empresa, '8536707-2', 'Marisol De Las Mercedes Diaz', 'Almacen', 'Carmen Mena 582', 'San Miguel', 'Santiago', null, null, true, null, 'Marisol D', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1000),
    (v_empresa, '10977136-8', 'Marisol del Carmen Loaiza Moya', 'Almacen', 'Av. Pintor Murillo N° 5525', 'San Joaquín', 'Santiago', null, null, false, '92', 'Marisol Loaiza', 'Juan Sanchez', null, 'CREDITO', 1200),
    (v_empresa, '18693205-6', 'Marjorie Andrea Acevedo Villa', 'Almacen', 'Rio de Janeiro N° 5679', 'San Miguel', 'Santiago', null, '973302802', true, null, 'Marjorie', 'Juan Sanchez', null, null, 1900),
    (v_empresa, '77515972-3', 'Mi Chiquinquireña SPA', 'Botillería', 'Av. Departamental 582', 'San Miguel', 'Santiago', null, null, true, null, 'Chiquin', 'Juan Sanchez', null, 'CREDITO', 1900),
    (v_empresa, '13294438-5', 'Miguel Angel Valencia Romero', 'Almacen', 'Sebastopol N° 576', 'San Miguel', 'Santiago', null, null, true, '143', 'MIGUEL', 'Juan Sanchez', null, null, null),
    (v_empresa, '78120504-4', 'Minimarket Full SPA', 'Minimarket', 'Gran Avenida N° 4381', 'San Miguel', 'Santiago', null, '949730970', true, '139', 'FULL SPA', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '10977742-0', 'Mireya Luisa de la Torre Save', 'Almacén', 'Tomás de Campanella N°5138-A', 'San Joaquín', 'Santiago', null, null, false, '83', 'Mireya Luisa', 'Juan Sanchez', null, 'CREDITO', 900),
    (v_empresa, '77001652-5', 'Mnimarket Edita Robles Mardones E.I.R.L', 'Mnimarket', 'Carmen Mena N°702', 'San Miguel', 'Santiago', null, '978897225 - 963639463', false, '95', 'Edita', 'Juan Sanchez', null, 'CREDITO', 1000),
    (v_empresa, '80393200-K', 'Molinos Cunaco S.A', 'Molino de Harina de Trigo', 'Chacra El Descanso S/N, Lote 3', 'Peñaflor', 'Santiago', 'slabbe@cunaco.cl', '26162400', true, null, 'CUNACO', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '10786034-7', 'Myriam Luz Gonzalez Galaz', 'Almacen', 'Aragon Nº 399, Villa Cervantes', 'San Joaquin', 'Santiago', null, null, true, '105', 'Myriam', 'Juan Sanchez', null, null, 1900),
    (v_empresa, '7201891-5', 'Nancy Audolia Del Carmen Ortega', 'Minimarket', 'Varas Mena Nº 661', 'San Miguel', 'Santiago', null, null, true, '5', 'Nancy', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1600),
    (v_empresa, '4367058-1', 'Narciso Gonzalez', 'Almacen', 'Tamenbaun N° 923', 'San Miguel', 'Santiago', null, '4597102', true, '4', 'Narciso Gonzalez', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 1800),
    (v_empresa, '9482840-6', 'Naroa de Lourdes Labra Galleguillos', 'Almacen', 'Av. América Nº 619', 'San Miguel', 'Santiago', null, '9 8566 8133', true, null, 'Naroa', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1900),
    (v_empresa, '17689304-4', 'Natalia Denisse Soto Orellana', 'Almacen', 'Porto Alegre Nº 5663', 'San Miguel', 'Santiago', null, null, true, '120', 'Natalia', 'Luis Albornoz', null, null, 1900),
    (v_empresa, '16339694-7', 'Nataly Andrea  Fuentes Bascuñan', 'Almacen', 'Vargas Buston 906', 'San Miguel', 'Santiago', null, '86060526', false, '27', 'Nataly', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 900),
    (v_empresa, '90703000-8', 'Nestlé Chile S.A', 'Alimentos', 'Avenida Las Condes N° 11287 Torre A', 'Las Condes', 'Santiago', 'nestle.professional13103@gmail.com', null, true, null, 'Nestlé', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '85003400-1', 'Panaderia Contreras Ltda', 'Panaderia', 'Padre Araya N? 1435', 'CURICO', 'Santiago', null, null, true, '101', 'VillaPrat', 'Panaderia Maruxa', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '8595308-7', 'Patricia del Carmen Gallegos Delgado', 'Almacen', 'Tannenbaum Nº 607', 'San Miguel', 'Santiago', null, null, true, '1', 'Patricia', 'Juan Sanchez', null, 'CREDITO', 1200),
    (v_empresa, '14199300-3', 'Patricio Andrés Irribarra Garcia', 'Almacen', 'Francisco Toledo N° 5730', 'San Joaquín', 'Santiago', null, null, true, '130', 'CAROL', 'Juan Sanchez', null, null, 1900),
    (v_empresa, '6383160-3', 'Raquel del Carmen Alegria Reveco', 'Almacen', 'Pentagrama 416-G', 'SIN COMUNA', 'Santiago', null, null, true, '79', 'Raquel', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '6192678-K', 'Rosa Del Carmen Fernandez Gonzalez', 'Almacen', 'Las Notas 421 H Villa Berlioz', 'San Joaquin', 'Santiago', null, '5110355', true, '55', 'Rosa F', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 950),
    (v_empresa, '2979148-1', 'Rosa Perez Rodriguez', 'Almacen de comestibl', 'Varas Mena N? 389', 'San Joaquin', 'Santiago', null, null, false, '73', 'Rosa P', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 950),
    (v_empresa, '4721162-K', 'Rosa Ulloa Lopez', 'Almacen', 'Alvear 6444', 'San Ram?n', 'Santiago', null, null, false, '25', 'Rosa V.', 'Juan Sanchez', 'EFECTIVO', 'CREDITO', 900),
    (v_empresa, '7350473-2', 'ROSA VERGARA', 'ALMACEN', 'CURITIBA  5648', 'SAN MIGUEL', 'SAN MIGUEL', null, '+56963467364', true, null, 'ROSA', 'Juan Sanchez', null, null, null),
    (v_empresa, '76225494-8', 'Rubber Tech SPA', 'proveedor productos caucho', 'Santa Rosa 5730', 'San Joaquin', 'Santiago', '-csalmes@rubbetech.cl', null, true, null, 'Rublos', 'Panaderia Maruxa', null, null, null),
    (v_empresa, '7383425-2', 'Ruth de las Mercedes Duran Allende', 'Almacen', 'Juan Plana N°5695', 'San Joaquín', 'Santiago', null, '225116020', true, null, 'ruth', 'Juan Sanchez', null, 'CREDITO', 1900),
    (v_empresa, '9435267-3', 'Ruth Elena Gomez Morales', 'Almacén', 'Tannembaum Nº 923', 'San Miguel', 'Santiago', null, '994086115', true, '4', 'TIO NACHO', 'Juan Sanchez', null, null, 1900),
    (v_empresa, '11169207-6', 'Sandra de las Mercedes Contreras Paredes', 'Almacen', 'Pedro Mira Nº 357', 'San Joaquín', 'Santiago', null, '962432395', true, '128', 'SANDRA C', 'Juan Sanchez', null, null, 1800),
    (v_empresa, '15589303-6', 'Sandra Elizabeth Villa Sanhueza', 'Almacen', 'Pje. 3. N? 519, Villa Austral', 'San Miguel', 'Santiago', null, null, false, '74', 'Sandra V', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1050),
    (v_empresa, '10163745-K', 'Sandra Ester Gaete Carbonel', 'Almacen', 'Av. La Castrina Nº 360', 'San Joaquin', 'Santiago', null, null, true, '116', 'Sandra Gaete', 'Juan Sanchez', null, null, null),
    (v_empresa, '10369675-5', 'Sandra Muñoz L', 'Almacen', 'Chiloe N? 5888', 'SIN COMUNA', 'Santiago', null, null, true, '63', 'Sandra', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '12260300-8', 'Sandro Marcelo Escobar Carranza', 'Comercio Por Menor V', 'Carmen Mena N? 538', 'SIN COMUNA', 'Santiago', null, '225268596', true, '77', 'Sandro', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '19659507-4', 'Sara Vanina Nievas Apablaza', 'Elaboración de Alimentos', 'Juan Aravena 497A', 'San Joaquín', 'Santiago', null, null, false, '93', 'Sara', 'Juan Sanchez', null, 'CREDITO', 1000),
    (v_empresa, '76400107-9', 'Servicio de Alimentacion Soto Gonzalez Ltda', 'Alimentacion', 'Departamental N? 457', 'San Joaquin', 'Santiago', null, null, true, '103', 'Serv. A', 'Panaderia Maruxa', 'EFECTIVO', 'CREDITO', 1140),
    (v_empresa, '76605984-8', 'Servicios Gastronomicos Charly-Rod Ltda', 'Comida Rápida', 'Sebastopol N° 408', 'San Joaquin', 'Santiago', null, null, true, null, 'Charly', 'Panaderia Maruxa', null, 'CREDITO', null),
    (v_empresa, '76537566-5', 'Servicios Gastronomicos Manuel Silva M EIRL', 'Restaurant', 'Credito N° 471', 'Providencia', 'Santiago', null, null, true, null, 'Servicios Gastronomicos', 'Panaderia Maruxa', null, 'CREDITO', 1140),
    (v_empresa, '7695754-1', 'Silvia Gallardo Cabello', 'Almacen', 'Pje. Sao Paulo #456 Pb.Br', 'SIN COMUNA', 'Santiago', null, '5260623', true, '68', 'Silvia', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '99506110-4', 'Soc. de Transporte Intertecno S.A', 'Transporte', 'General Gonzalez Balarce N? 2023', 'SIN COMUNA', 'Santiago', null, '65653131', true, '102', 'Soc. de Transp.', 'Panaderia Maruxa', 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '76503857-K', 'Sociedad Garcia Inmobilier y Compañia Limitada', 'MiniMarket', 'Benozzo Gozzolli Nº 5596', 'San Joaquin', 'Santiago', null, null, true, '102', 'Inmobilier', 'Luis Albornoz', null, null, 1100),
    (v_empresa, '18479419-5', 'Tabita Noemí Rojas Romero', 'Almacen', 'Francisco de Toledo N° 5694', 'San Joaquín', 'Santiago', null, '228138859', true, null, null, 'Luis Albornoz', null, 'CREDITO', 1800),
    (v_empresa, '76188003-9', 'TELECOMUNICACIONES QUALITY WAY CHILE', 'TELECOMUNICACIONES', 'SEBASTOPOL N° 540', 'SAN MIGUEL', 'SANTIAGO', 'gustavo.vallejos@telqway.cl', null, true, null, null, null, 'EFECTIVO', 'CREDITO', null),
    (v_empresa, '15668418-K', 'Teresita de Jesús Veliz Quintanilla', 'Almacen', 'Bermuda Nº 6314, La Castrina', 'San Joaquín', 'Santiago', null, '+56 9 9981 1791', true, null, 'Teresita', 'Luis Albornoz', null, 'CREDITO', 1700),
    (v_empresa, '76577773-9', 'Tiempo - Delivery Ltda', 'Vta. Huevos, Frutas.', 'Varas Mena N° 1051', 'San Miguel', 'Santiago', null, null, false, null, 'Tiempo', 'Juan Sanchez', null, 'CREDITO', 900),
    (v_empresa, '13086738-3', 'Valeria Angelina Díaz Caro', 'Almacen', 'Chile Chico N? 031', 'La Granja', 'Santiago', null, null, false, '78', 'Valeria', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 950),
    (v_empresa, '11664198-4', 'Valeria Valentina Barrera Pizarro', 'Almacen', 'Alvear N°5546', 'SIN COMUNA', 'Santiago', null, null, true, '94', 'Valeria V.', 'Panaderia Maruxa', null, 'CREDITO', 1000),
    (v_empresa, '15451382-5', 'Victor Manuel Mora Antilao', 'Almacen', 'Lo Ovalle N? 625', 'San Miguel', 'Santiago', null, null, true, '66', 'Victor', 'Luis Albornoz', 'EFECTIVO', 'CREDITO', 1000),
    (v_empresa, '6023128-1', 'Zapata Severino Sergio Armando', 'ALMACEN', 'LEON TOLSTOI N 6155', 'SAN MIGUEL', 'SANTIAGO', null, null, true, '113', 'EL LELO', 'Panaderia Maruxa', null, null, null)
  on conflict (empresa_id, rut) do update set
    razon_social = excluded.razon_social,
    giro = excluded.giro,
    direccion = excluded.direccion,
    comuna = excluded.comuna,
    ciudad = excluded.ciudad,
    email = coalesce(excluded.email, public.clientes.email),
    telefono = coalesce(excluded.telefono, public.clientes.telefono),
    activo = excluded.activo,
    codigo_legacy = coalesce(excluded.codigo_legacy, public.clientes.codigo_legacy),
    sigla = coalesce(excluded.sigla, public.clientes.sigla),
    repartidor_nombre = coalesce(excluded.repartidor_nombre, public.clientes.repartidor_nombre),
    forma_pago = coalesce(excluded.forma_pago, public.clientes.forma_pago),
    plazo_pago = coalesce(excluded.plazo_pago, public.clientes.plazo_pago),
    precio_base = coalesce(excluded.precio_base, public.clientes.precio_base),
    updated_at = now();

  insert into public.cliente_producto_precios (empresa_id, cliente_id, producto_id, precio)
  select
    v_empresa,
    c.id,
    p.id,
    origen.precio
  from (values
    ('76659512-K', 'PAN CORRIENTE', 1000),
    ('76659512-K', 'PAN ESPECIAL', 700),
    ('12491022-6', 'PAN CORRIENTE', 1300),
    ('12491022-6', 'PAN ESPECIAL', 1000),
    ('16912435-3', 'PAN CORRIENTE', 900),
    ('16912435-3', 'PAN ESPECIAL', 550),
    ('6873088-0', 'PAN CORRIENTE', 1100),
    ('6873088-0', 'PAN ESPECIAL', 700),
    ('76029743-7', 'PAN CORRIENTE', 2550),
    ('76029743-7', 'PAN ESPECIAL', 800),
    ('7317305-1', 'PAN CORRIENTE', 1900),
    ('7317305-1', 'PAN ESPECIAL', 900),
    ('4525258-2', 'PAN CORRIENTE', 1700),
    ('77343454-9', 'PAN CORRIENTE', 1300),
    ('77343454-9', 'PAN ESPECIAL', 1000),
    ('13298854-4', 'PAN CORRIENTE', 1900),
    ('13298854-4', 'PAN ESPECIAL', 700),
    ('5813439-2', 'PAN CORRIENTE', 1800),
    ('5813439-2', 'PAN ESPECIAL', 900),
    ('8042001-3', 'PAN CORRIENTE', 1900),
    ('8042001-3', 'PAN ESPECIAL', 700),
    ('6463363-5', 'PAN CORRIENTE', 1200),
    ('6463363-5', 'PAN ESPECIAL', 800),
    ('17053359-3', 'PAN CORRIENTE', 1000),
    ('17053359-3', 'PAN ESPECIAL', 650),
    ('15888481-K', 'PAN CORRIENTE', 1800),
    ('15888481-K', 'PAN ESPECIAL', 900),
    ('15544902-0', 'PAN CORRIENTE', 1900),
    ('15544902-0', 'PAN ESPECIAL', 900),
    ('13938306-0', 'PAN CORRIENTE', 1900),
    ('13938306-0', 'PAN ESPECIAL', 900),
    ('23277642-0', 'PAN CORRIENTE', 1800),
    ('23277642-0', 'PAN ESPECIAL', 900),
    ('77268161-5', 'PAN CORRIENTE', 1700),
    ('77268161-5', 'PAN ESPECIAL', 900),
    ('77258036-3', 'PAN CORRIENTE', 1800),
    ('77258036-3', 'PAN ESPECIAL', 900),
    ('77143442-8', 'PAN CORRIENTE', 1900),
    ('76393220-6', 'PAN CORRIENTE', 1900),
    ('77315052-4', 'PAN CORRIENTE', 1800),
    ('76904885-5', 'PAN CORRIENTE', 1900),
    ('77232653-K', 'PAN CORRIENTE', 950),
    ('77232653-K', 'PAN ESPECIAL', 650),
    ('19844794-3', 'PAN CORRIENTE', 1900),
    ('19844794-3', 'PAN ESPECIAL', 900),
    ('11268963-K', 'PAN CORRIENTE', 950),
    ('11268963-K', 'PAN ESPECIAL', 600),
    ('77866852-1', 'PAN CORRIENTE', 1800),
    ('6346761-8', 'PAN CORRIENTE', 1950),
    ('6346761-8', 'PAN ESPECIAL', 900),
    ('78294273-5', 'PAN CORRIENTE', 1900),
    ('11887470-6', 'PAN CORRIENTE', 1000),
    ('11887470-6', 'PAN ESPECIAL', 850),
    ('7702877-3', 'PAN CORRIENTE', 1900),
    ('7702877-3', 'PAN ESPECIAL', 900),
    ('16243444-6', 'PAN CORRIENTE', 1500),
    ('16243444-6', 'PAN ESPECIAL', 700),
    ('5129602-8', 'PAN CORRIENTE', 1900),
    ('5129602-8', 'PAN ESPECIAL', 900),
    ('15888361-9', 'PAN CORRIENTE', 1900),
    ('15888361-9', 'PAN ESPECIAL', 900),
    ('11255161-1', 'PAN CORRIENTE', 2000),
    ('11255161-1', 'PAN ESPECIAL', 900),
    ('77006924-6', 'PAN CORRIENTE', 1200),
    ('77006924-6', 'PAN ESPECIAL', 700),
    ('16817532-9', 'PAN CORRIENTE', 1000),
    ('16817532-9', 'PAN ESPECIAL', 650),
    ('77412593-0', 'PAN CORRIENTE', 1800),
    ('16042368-4', 'PAN CORRIENTE', 1950),
    ('16042368-4', 'PAN ESPECIAL', 700),
    ('12509986-6', 'PAN CORRIENTE', 1900),
    ('12509986-6', 'PAN ESPECIAL', 900),
    ('77654134-6', 'PAN CORRIENTE', 1900),
    ('77654134-6', 'PAN ESPECIAL', 2300),
    ('11360363-1', 'PAN CORRIENTE', 1000),
    ('11360363-1', 'PAN ESPECIAL', 1000),
    ('8458416-9', 'PAN CORRIENTE', 1900),
    ('7253082-9', 'PAN CORRIENTE', 1200),
    ('7253082-9', 'PAN ESPECIAL', 600),
    ('9588132-7', 'PAN CORRIENTE', 1850),
    ('9588132-7', 'PAN ESPECIAL', 900),
    ('79998040-1', 'PAN CORRIENTE', 1200),
    ('79998040-1', 'PAN ESPECIAL', 850),
    ('77427069-8', 'PAN CORRIENTE', 1800),
    ('76614541-8', 'PAN CORRIENTE', 1050),
    ('76614541-8', 'PAN ESPECIAL', 700),
    ('14460080-0', 'PAN CORRIENTE', 1900),
    ('14460080-0', 'PAN ESPECIAL', 900),
    ('77214448-2', 'PAN CORRIENTE', 1900),
    ('6061001-0', 'PAN CORRIENTE', 1200),
    ('16451545-1', 'PAN CORRIENTE', 1800),
    ('7890517-4', 'PAN CORRIENTE', 1800),
    ('7890517-4', 'PAN ESPECIAL', 700),
    ('12791373-0', 'PAN CORRIENTE', 1900),
    ('12791373-0', 'PAN ESPECIAL', 900),
    ('25561963-2', 'PAN CORRIENTE', 1800),
    ('13415596-5', 'PAN CORRIENTE', 1800),
    ('13415596-5', 'PAN ESPECIAL', 900),
    ('77991198-5', 'PAN CORRIENTE', 1900),
    ('15340717-7', 'PAN CORRIENTE', 950),
    ('15340717-7', 'PAN ESPECIAL', 600),
    ('77434418-7', 'PAN CORRIENTE', 1900),
    ('76835983-0', 'PAN CORRIENTE', 1000),
    ('76835983-0', 'PAN ESPECIAL', 600),
    ('7013679-1', 'PAN CORRIENTE', 1800),
    ('7013679-1', 'PAN ESPECIAL', 900),
    ('9480478-7', 'PAN CORRIENTE', 1900),
    ('9480478-7', 'PAN ESPECIAL', 900),
    ('9877560-9', 'PAN CORRIENTE', 1900),
    ('9877560-9', 'PAN ESPECIAL', 700),
    ('12640961-3', 'PAN CORRIENTE', 1900),
    ('12640961-3', 'PAN ESPECIAL', 1300),
    ('9484447-9', 'PAN CORRIENTE', 1900),
    ('9484447-9', 'PAN ESPECIAL', 900),
    ('5438955-8', 'PAN CORRIENTE', 1900),
    ('5438955-8', 'PAN ESPECIAL', 900),
    ('9879370-4', 'PAN CORRIENTE', 1900),
    ('9879370-4', 'PAN ESPECIAL', 900),
    ('7206136-5', 'PAN CORRIENTE', 950),
    ('7206136-5', 'PAN ESPECIAL', 600),
    ('8536707-2', 'PAN CORRIENTE', 1000),
    ('8536707-2', 'PAN ESPECIAL', 700),
    ('10977136-8', 'PAN CORRIENTE', 1200),
    ('10977136-8', 'PAN ESPECIAL', 650),
    ('18693205-6', 'PAN CORRIENTE', 1900),
    ('77515972-3', 'PAN CORRIENTE', 1900),
    ('77515972-3', 'PAN ESPECIAL', 900),
    ('10977742-0', 'PAN CORRIENTE', 900),
    ('10977742-0', 'PAN ESPECIAL', 600),
    ('77001652-5', 'PAN CORRIENTE', 1000),
    ('77001652-5', 'PAN ESPECIAL', 600),
    ('10786034-7', 'PAN CORRIENTE', 1900),
    ('7201891-5', 'PAN CORRIENTE', 1600),
    ('7201891-5', 'PAN ESPECIAL', 900),
    ('4367058-1', 'PAN CORRIENTE', 1800),
    ('4367058-1', 'PAN ESPECIAL', 900),
    ('9482840-6', 'PAN CORRIENTE', 1900),
    ('9482840-6', 'PAN ESPECIAL', 900),
    ('17689304-4', 'PAN CORRIENTE', 1900),
    ('16339694-7', 'PAN CORRIENTE', 900),
    ('16339694-7', 'PAN ESPECIAL', 600),
    ('8595308-7', 'PAN CORRIENTE', 1200),
    ('8595308-7', 'PAN ESPECIAL', 700),
    ('14199300-3', 'PAN CORRIENTE', 1900),
    ('6192678-K', 'PAN CORRIENTE', 950),
    ('6192678-K', 'PAN ESPECIAL', 600),
    ('2979148-1', 'PAN CORRIENTE', 950),
    ('2979148-1', 'PAN ESPECIAL', 600),
    ('4721162-K', 'PAN CORRIENTE', 900),
    ('4721162-K', 'PAN ESPECIAL', 600),
    ('7383425-2', 'PAN CORRIENTE', 1900),
    ('7383425-2', 'PAN ESPECIAL', 900),
    ('9435267-3', 'PAN CORRIENTE', 1900),
    ('11169207-6', 'PAN CORRIENTE', 1800),
    ('15589303-6', 'PAN CORRIENTE', 1050),
    ('15589303-6', 'PAN ESPECIAL', 700),
    ('19659507-4', 'PAN CORRIENTE', 1000),
    ('19659507-4', 'PAN ESPECIAL', 650),
    ('76400107-9', 'PAN CORRIENTE', 1190),
    ('76400107-9', 'PAN ESPECIAL', 700),
    ('76537566-5', 'PAN CORRIENTE', 1190),
    ('76537566-5', 'PAN ESPECIAL', 650),
    ('76503857-K', 'PAN CORRIENTE', 1100),
    ('76503857-K', 'PAN ESPECIAL', 900),
    ('18479419-5', 'PAN CORRIENTE', 1800),
    ('18479419-5', 'PAN ESPECIAL', 900),
    ('15668418-K', 'PAN CORRIENTE', 1700),
    ('15668418-K', 'PAN ESPECIAL', 900),
    ('76577773-9', 'PAN CORRIENTE', 900),
    ('76577773-9', 'PAN ESPECIAL', 550),
    ('13086738-3', 'PAN CORRIENTE', 950),
    ('13086738-3', 'PAN ESPECIAL', 600),
    ('11664198-4', 'PAN CORRIENTE', 1000),
    ('11664198-4', 'PAN ESPECIAL', 650),
    ('15451382-5', 'PAN CORRIENTE', 1000),
    ('15451382-5', 'PAN ESPECIAL', 700)
  ) as origen(rut, producto_nombre, precio)
  join public.clientes c
    on c.empresa_id = v_empresa and c.rut = origen.rut
  join public.productos p
    on p.empresa_id = v_empresa and upper(trim(p.nombre)) = origen.producto_nombre
  on conflict (cliente_id, producto_id) do update set
    precio = excluded.precio,
    activo = true,
    updated_at = now();
end $$;

commit;
