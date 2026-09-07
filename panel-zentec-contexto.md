# Panel Zentec — Contexto y plan de trabajo

Documento para arrancar el trabajo del panel web en Claude Code.
Fecha: 2 de septiembre de 2026.

---

## 1. Qué es esto

Zentec es una empresa de tecnología y seguridad en Acapulco (CCTV, redes,
control de acceso, domótica, cómputo). Marcos Sánchez es el dueño y opera el
negocio.

Ya existe un **sistema de atención por WhatsApp** funcionando en producción:
un bot que atiende clientes, califica prospectos, arma cotizaciones con
precios de catálogo y las manda en PDF. Corre sobre n8n + Supabase + la Cloud
API oficial de Meta.

**El panel web es la otra mitad**: lo que WhatsApp no puede hacer bien. Hoy
existe pero está incompleto y sin autenticación.

**Principio de diseño**: el panel no compite con WhatsApp, lo complementa. La
operación diaria seguirá siendo por chat porque es más rápido. El panel es
para lo que el chat hace mal: ver conjuntos, comparar, filtrar, editar en
masa, subir archivos, revisar historial.

Consecuencia práctica: priorizar **densidad de información** sobre estética
espaciosa. Tablas con muchas filas visibles, filtros rápidos, edición en línea.
No un dashboard con tres tarjetas gigantes.

---

## 2. Estado actual del panel

- Vive en `/var/www/zentec-panel/dist` en el VPS (build)
- Servido por nginx dentro de Docker, detrás de Traefik
- URL: `https://panel.zentec.solutions` (HTTPS con certificado Let's Encrypt)
- El puerto 8080 quedó cerrado en el firewall
- React + Vite, se conecta a Supabase **directamente desde el navegador** con
  la publishable key (anon)
- Tablas que consulta hoy: `clientes`, `configuracion`, `cotizaciones`,
  `facturas`, `ordenes_trabajo`, `productos`
- **No tiene login**
- **RLS acaba de activarse en todas las tablas**, así que ahora mismo el panel
  no muestra datos. Es intencional: estaba sirviendo datos de clientes a
  cualquiera con la URL.

El código fuente está en Git. En el VPS solo está el build.

---

## 3. Base de datos (Supabase, proyecto `nfuchlxbqvjyjlmbowgf`)

### Tablas en uso por el bot

| Tabla | Contenido |
|---|---|
| `bot_prospectos` | numero, nombre, email |
| `bot_solicitudes` | servicio, detalles, direccion, notas, etapa |
| `bot_conversaciones` | numero, rol, mensaje, created_at — historial completo |
| `bot_admins` | numero, nombre, activo |
| `bot_admin_sesion` | numero, activa, folio_actual, historial |

### Tablas del CRM

**`clientes`**: `id` (uuid), `nombre`, `direccion`, `telefono` (text, se
guarda a 10 dígitos), `email`, `rfc`, `razon_social`, `uso_cfdi`,
`regimen_fiscal`, `created_at`

**`productos`**: `id` (uuid), `nombre`, `modelo`, `precio`, `descripcion`.
24 activos. **21 no tienen imagen** — las imágenes viven en el bucket público
`Productos` de Supabase Storage y las usa el PDF de cotización.

**`cotizaciones`**: el folio está en la columna **`consecutivo`** (no `folio`);
el FK al cliente es **`cliente_id`**. Además: `solicitud_id`, `pdf_url`,
`con_iva`, `revisada_por`, `revisada_desde`, `enviada_at`, `archivo_pdf`,
`total`, `estado`.
- Secuencia: `cotizaciones_folio_seq`
- Índice único `cotizaciones_solicitud_uniq`: una cotización por solicitud
- Estados: `borrador`, `en_revision`, `aprobada`, `enviada`, `rechazada`

**`cotizacion_productos`**: partidas de cada cotización
(`cotizacion_id`, `producto_id`, `cantidad`, `precio_unitario`)

### Tablas vacías, estructura ya diseñada

**`ordenes_trabajo`**: `id`, `cotizacion_id`, `descripcion`, `estado`,
`fecha_inicio`, `fecha_fin`, `created_at`

**`facturas`** — es un módulo de cobranza completo:
- Fiscal: `numero_factura`, `uuid_cfdi`, `serie`, `folio`, `fecha_timbrado`,
  `xml_cfdi`, `pdf_url`, `estado_cfdi`
- Montos: `subtotal`, `iva`, `total`
- Anticipo: `requiere_anticipo`, `porcentaje_anticipo`, `monto_anticipo`,
  `anticipo_pagado`, `fecha_pago_anticipo`
- Saldo: `saldo_pendiente`, `pagado_total`, `fecha_pago_total`, `metodo_pago`
- Cobranza: `fecha_vencimiento`, `recordatorios_enviados`,
  `ultimo_recordatorio`
- `cotizacion_id`, `orden_id`, `notas`, `created_at`

**`configuracion`**: `id`, `clave`, `valor`, `descripcion`. Vacía. Es el lugar
natural para mover las constantes que hoy están quemadas en prompts y en el
docker-compose (cargo de la firma, porcentaje de anticipo, vigencia).

Las tres están **vacías**, así que se pueden modificar sin migrar datos.

### La cadena completa del negocio

```
prospecto → solicitud → cotización → [aprobada] → orden de trabajo
                                                        ↓
                                                    factura
                                                   ↓        ↓
                                             anticipo    saldo
                                                          ↓
                                                  recordatorios
```

Hoy está construido hasta "cotización aprobada y enviada". De ahí en adelante
las tablas existen pero nada las llena.

---

## 4. Reglas de negocio

- **Los precios salen siempre del catálogo.** Nadie manda un precio suelto en
  una partida. Para cambiar un precio se edita el producto.
- **Se cotiza a precio de lista**, el más alto. Descuentos por volumen a mano.
- **IVA 16% solo si el cliente pide factura** (columna `con_iva`).
- **Anticipo del 70%** para trabajos de instalación.
- **Vigencia de la cotización: fin del mes en curso.**
- **Una cotización por solicitud.**
- **Firma**: Ing. Marcos Sánchez, Director General.
- Teléfonos: se guardan a 10 dígitos; WhatsApp necesita `521` + 10.

---

## 5. Autenticación y roles (a construir)

Hoy usa solo Marcos, pero habrá más usuarios. Dejar la estructura preparada
desde el inicio aunque solo exista un usuario.

### Esquema propuesto

```sql
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  rol text not null default 'vendedor'
    check (rol in ('admin','vendedor','tecnico')),
  activo boolean not null default true,
  created_at timestamptz default now()
);

create or replace function public.mi_rol()
returns text language sql stable security definer as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;
```

### Roles y qué puede cada uno

| Rol | Alcance |
|---|---|
| `admin` | Todo. Catálogo, precios, facturación, configuración, usuarios. |
| `vendedor` | Prospectos, clientes, cotizaciones. **No** edita catálogo ni ve márgenes. |
| `tecnico` | Solo las órdenes de trabajo que tiene asignadas. |

Para el rol técnico habrá que agregar una columna `tecnico_id` a
`ordenes_trabajo` que hoy no existe.

### Patrón de políticas

```sql
-- Lectura para cualquier autenticado
create policy "leer productos" on public.productos
  for select to authenticated using (true);

-- Escritura solo admin
create policy "editar productos" on public.productos
  for all to authenticated using (public.mi_rol() = 'admin');
```

**Importante**: n8n se conecta con la credencial de Postgres directa, que
salta RLS. El bot no se ve afectado por estas políticas y sigue funcionando.

---

## 6. Qué le falta al panel

### 6.1 Login (urgente, bloquea todo lo demás)

Sin esto el panel no muestra datos, porque RLS ya está activo. Es el primer
trabajo y debería ir solo, sin mezclarse con el rediseño.

Alcance mínimo: pantalla de login con Supabase Auth (correo + contraseña),
sesión persistente, logout, y protección de rutas. Crear el usuario de Marcos
a mano en Supabase.

### 6.2 CRUDs que faltan

- **Productos**: alta, edición, baja lógica. **Con subida de imágenes al
  bucket `Productos`** — hay 21 productos sin foto y hacerlo por WhatsApp es
  impráctico. Las imágenes las consume el PDF de cotización.
- **Clientes**: alta y edición, incluyendo los datos fiscales
  (`rfc`, `razon_social`, `uso_cfdi`, `regimen_fiscal`).
- **Cotizaciones**: editar partidas de una cotización existente. Por WhatsApp
  funciona para 2 o 3 líneas; para 10 es tortuoso.
- **Configuración**: editar los pares clave/valor.

### 6.3 Módulos nuevos propuestos

**Pipeline de prospectos.** Hoy no hay forma de ver cuántos prospectos están
abiertos, cuáles llevan días sin moverse, cuáles se enfriaron. Tabla con
filtros por etapa y antigüedad, sobre `bot_prospectos` + `bot_solicitudes`.

**Historial de conversación.** `bot_conversaciones` tiene todo lo que cada
cliente le dijo al bot y hoy no hay dónde leerlo. Poder abrir un prospecto y
ver la conversación completa antes de llamarlo es muy útil.

**Tablero de inicio.** Cuatro números al abrir: prospectos nuevos esta semana,
cotizaciones pendientes de revisar, cotizaciones enviadas sin respuesta,
órdenes de trabajo abiertas. Todo sale de consultas simples sobre lo que ya
existe.

**Órdenes de trabajo.** Crear una orden desde una cotización aprobada.
Estados, fechas, y a futuro asignación a técnico. Es el eslabón que falta
entre "el cliente aceptó" y "se instaló".

**Cobranza.** Registrar la factura de una orden, controlar el anticipo del
70%, ver saldos pendientes y vencimientos. **Esto funciona sin timbrar**: el
panel registra la factura que se timbra por fuera.

### 6.4 Timbrado CFDI (dejar para el final)

Marcos quiere facturar desde el panel y ha trabajado antes con PACs.

**Recomendación: es lo último.** No por dificultad técnica sino por
dependencias que no son de código: se necesita e.firma y CSD vigentes,
contratar un PAC (Facturama, SW Sapien, Finkok), y hacer pruebas en su
sandbox antes de emitir en producción. Un CFDI mal timbrado es un problema
fiscal, no un bug.

La cobranza (6.3) da valor desde el día uno y funciona igual timbre Marcos o
su contador. El timbrado se puede agregar después sin rehacer nada, porque la
tabla `facturas` ya tiene los campos.

---

## 7. Oportunidad fuera del panel

`facturas` tiene `fecha_vencimiento`, `recordatorios_enviados` y
`ultimo_recordatorio`. Con el canal de WhatsApp ya funcionando, un workflow
programado en n8n que revise facturas vencidas y mande el recordatorio es
directo de armar. No requiere panel.

Ojo con la ventana de 24 horas de Meta: para escribirle a alguien que no ha
escrito en las últimas 24 h hace falta una **plantilla aprobada**. Habría que
crear una para recordatorios de pago.

---

## 8. Orden sugerido

1. **Login + políticas RLS básicas** — desbloquea el panel, corto y aislado
2. **CRUD de productos con imágenes** — resuelve un dolor real (21 sin foto)
3. **CRUD de clientes** con datos fiscales
4. **Tablero de inicio** — barato y de alto valor percibido
5. **Pipeline + historial de conversación** — usa datos que ya existen
6. **Rediseño visual** — cuando ya esté claro qué contiene cada pantalla
7. **Órdenes de trabajo**
8. **Cobranza sin timbrado**
9. **Timbrado CFDI** — al final, con las dependencias fiscales resueltas

El rediseño va en el paso 6 a propósito: rediseñar pantallas cuyo contenido
todavía va a cambiar es trabajo que se tira.

---

## 9. Notas de operación

- El sistema de WhatsApp está en producción y **no debe romperse**. n8n usa
  conexión Postgres directa; RLS no lo afecta.
- Credenciales rotadas el 2/sep/2026: API key de Anthropic y token de Meta.
  El token de Meta vive como credencial de n8n (`Meta WhatsApp`, Header Auth).
- Firewall UFW activo: solo 22, 80 y 443 abiertos.
- Pendiente de limpieza: dar de baja Evolution API del VPS, borrar el workflow
  `zentec-whatsbot`, quitar `--api.insecure=true` de Traefik.
- Sin respaldo automático de `/local-files`, donde viven los PDFs de
  cotización. Pendiente.
