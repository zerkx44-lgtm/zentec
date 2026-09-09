# Bitácora del sistema Zentec

## Estado actual

**8 de septiembre de 2026 — corrección de un supuesto.** La bitácora del 7 de
septiembre decía que "los botones del ciclo del dinero están desconectados".
Es falso y da una impresión equivocada: `Facturas.jsx:31` y `Facturas.jsx:45`
sí escriben dinero hoy, calculando `saldo_pendiente: Math.max(total -
anticipo, 0)` en el navegador. Con RLS en `using (true)`, cualquiera con
sesión iniciada puede poner un saldo en cero desde la consola sin registrar un
pago, y no queda rastro. Lo que sí está desconectado son las funciones de
orden/factura del bot: no hay ninguna llamada `.rpc(` en todo `src/`.

Panel en producción en panel.zentec.solutions, actualizado el 7 de septiembre
de 2026. Siete pantallas funcionando con datos reales: tablero, prospectos,
conversaciones, cotizaciones, clientes, productos, órdenes, facturas y
configuración. Login con Supabase Auth, sesión persistente.

El rol de usuario se lee de la tabla `perfiles`, no del JWT, porque los
metadatos del usuario los puede editar el propio usuario y no sirven para
autorizar. La tabla `perfiles` no existe todavía y el panel está escrito para
tolerarlo: si no existe, entra sin rol y deja que RLS decida.

Las políticas RLS son provisionales (`using (true)` para autenticados),
aceptables mientras exista un solo usuario del panel.

Tema oscuro con acento cian, densidad de tabla alta (el panel existe para ver
conjuntos, que es lo que WhatsApp hace mal). Cristal esmerilado solo en
sidebar y métricas, no sobre tablas.

Existe una landing page en `landing/` dentro del mismo repo, con piel clara,
opuesta a la del panel.

El repo ya está empujado a `origin/main`: apunta al mismo SHA que `HEAD`
(65a2528), verificado el 8 de septiembre de 2026. Corrige la entrada anterior,
que decía que los seis commits eran locales.

El vocabulario de estados del panel ya coincide con los CHECK confirmados en
`paso0-resultados.md`: `Cotizaciones.jsx:4` tiene los cinco exactos,
`Ordenes.jsx:57` y `127-130` los cuatro. El paso 2 de ese documento se puede
tachar (verificado el 8 de septiembre de 2026).

Se crearon tres agentes en `~/.claude/agents/`: `zentec-arquitecto` (seguridad
y arquitectura), `zentec-marketing` (publicidad digital) y `watson` (esta
bitácora).

## Decisiones tomadas

**8 de septiembre de 2026 — sesión sin código, de verificación y diseño.**
No se tocó una sola línea de `src/`. El trabajo fue: verificar supuestos
contra el código real, y diseñar el alcance de cobranza/recibos/agenda para el
chat de base/n8n. El producto quedó en `~/Downloads/cobranza-recibos-y-agenda-
para-el-chat.md`, sucesor de `cierre-del-ciclo-para-el-chat.md`.

**8 de septiembre de 2026 — "facturación al final" significa el CFDI al
final, no la cobranza.** Marcos aclaró que la cobranza (saldos, anticipos,
pagos) se construye ahora; el CFDI se sigue timbrando por fuera del panel.

**8 de septiembre de 2026 — se van a emitir recibos de pago para servicios,
con control interno.** Alcance nuevo: ni "recibo" ni "pagos" aparecían en
`paso0-resultados.md`, ni en el arranque del proyecto, ni en la bitácora, ni
en el código, antes de esta sesión.

**8 de septiembre de 2026 — el recibo cuelga de la cotización, no de la
factura.** Así, si el cliente no pide factura, de todos modos recibe su
comprobante de pago.

**8 de septiembre de 2026 — Opción A: la cotización es el ancla de cobranza.**
El saldo se muda a `cotizaciones`, `pagos` cuelga de ahí, y `facturas` se crea
solo cuando el cliente pide factura. Se descartó la opción B (crear una fila
en `facturas` para todos los clientes) porque generaría registros de
"facturas" que no son facturas fiscales; ante el contador o el SAT esa tabla
mentiría.

**8 de septiembre de 2026 — matiz sobre la opción A: `facturas` no se toca.**
La primera versión de la propuesta adelgazaba esa tabla; se decidió que todo
sea aditivo, porque `subtotal` y `total` son `NOT NULL` ahí y no se sabe qué
funciones `bot_*` la leen.

**8 de septiembre de 2026 — `empresa_id` va denormalizada en `pagos`**, y se
recomendó lo mismo para `ordenes_trabajo` y `facturas`, contra lo que sugería
`paso0-resultados.md`. Motivo principal: una política RLS por join
(`exists (select 1 from cotizaciones where ...)`) sobre una fila con
`cotizacion_id` nulo devuelve falso, y la fila se vuelve invisible para todos,
incluido su dueño. Motivo secundario: una política que se lee de un vistazo
es una propiedad de seguridad, no un gusto estético.

**8 de septiembre de 2026 — un pago no se borra, se cancela.** Un recibo que
ya salió por correo existe en el mundo; si se borra de la base, en una
discusión sobre cuánto se debe, el papel que tiene el cliente le gana a la
pantalla. Corregir un pago es cancelarlo con motivo y registrar uno nuevo. Sin
edición de monto.

**8 de septiembre de 2026 — el folio del recibo va por secuencia dedicada,
nunca `max(folio)+1`.** Con n8n registrando pagos en paralelo, dos recibos con
el mismo folio a dos clientes distintos es un problema del que no se sale
bien.

**8 de septiembre de 2026 — los recibos se envían por correo desde n8n, con
el correo propio de Zentec por SMTP, no desde el panel.** Una credencial de
correo en el panel acabaría en el JavaScript público del navegador; si se
roba, se usa para phishing firmado por `zentec.solutions`, y quemar la
reputación del dominio significa que ni las cotizaciones le llegan ya a los
clientes.

**8 de septiembre de 2026 — el PDF del recibo va adjunto al correo, no
publicado en una URL.** Trae nombre, monto y método de pago, y los folios son
consecutivos: con URL pública predecible alguien podría recorrerlos y
reconstruir la facturación completa de Zentec.

**8 de septiembre de 2026 — el body del webhook de registrar pago lleva solo
`pago_id`.** Si llevara el monto, un atacante podría mandar recibos por
cantidades inventadas.

**8 de septiembre de 2026 — se mantiene "repo aparte" para la agenda; no
había conflicto con lo decidido antes.** La palabra "agenda" tapaba dos cosas
distintas: la agenda-producto (citas para salones y consultorios, con su
propio proyecto de Supabase, ver decisión del 7 de septiembre) y la
agenda-operación de Zentec (cuándo va el técnico a instalar, que vive en
`ordenes_trabajo`). El caso real que apareció hoy es el segundo, y es una
pantalla más del panel de Zentec, no del repo de citas. Meterla ahí sería el
error inverso: obligaría a ese build a cargar también la llave de Zentec.

**8 de septiembre de 2026 — la orden es la cita; no se crea tabla `visitas`
todavía.** Se agregan `hora_inicio`, `duracion_min` y `tecnico_id` a
`ordenes_trabajo`. El día que aparezca la primera orden que haya que partir en
dos visitas, se crea la tabla `visitas` y estas tres columnas se vuelven la
primera visita de esa orden.

**8 de septiembre de 2026 — la alarma para activar el paquete de seguridad
(perfiles + RLS por empresa) es `select count(*) from auth.users`, no la
intención de nadie.** "Mientras Marcos sea el único usuario" no se puede
vigilar. Cuando entre el segundo usuario, en un solo movimiento: crear
`perfiles`, meter el filtro por empresa dentro de las funciones `security
definer`, y cambiar las políticas de `using (true)`.

**7 de septiembre de 2026 — El panel de agenda va en un repo aparte, no como
módulo del panel de Zentec.** El panel se conecta a Supabase desde el
navegador con la publishable key, que queda visible dentro del build. Si los
dos productos compartieran build, ese build llevaría las dos llaves, y el
cliente del sistema de citas tendría en su navegador la llave del proyecto de
Zentec. Con paneles separados, cada build lleva solo la suya. Razones
secundarias: no comparten ni una pantalla, y el panel de Zentec ya está en
producción — no conviene arriesgarlo al desplegar el otro.

**7 de septiembre de 2026 — No se conecta el botón de "reenviar cotización por
WhatsApp" todavía.** Fuera de la ventana de 24 horas de Meta, la API acepta el
envío, devuelve un identificador y no entrega el mensaje. El panel diría
"enviada" y el cliente no recibiría nada: una certeza falsa sobre justo lo que
más importa. Mientras no haya plantilla aprobada, se descartó conectar el
botón y se dejó el enlace wa.me que ya existe, por ser más honesto.

**7 de septiembre de 2026 — Arena (el salón de uñas) pasó de cliente a
prueba.** Marcos decidió que no le interesa cerrarlo por ahora. Esto invalidó
una recomendación previa de priorizar el sistema de citas. La conclusión
nueva: todo lo que se construya ahora es para que Zentec opere mejor, y el
caso de éxito para vender lo va a construir la propia operación de Zentec con
sus números.

**El despliegue a producción lo autoriza Marcos, siempre.** Se propuso
autorizar la llave SSH de la Mac en el VPS para automatizarlo y se decidió que
no: nadie necesita acceso root permanente a un servidor donde corre un bot en
producción. El flujo acordado es que Claude Code compila y verifica, y Marcos
corre el rsync.

**Node no se instala con Homebrew en esta Mac.** Es Intel con macOS 26, y
Homebrew intenta compilar Node desde fuente, lo que tarda cerca de una hora.
Se instaló el binario oficial de nodejs.org v24.20.0 en `~/.local/node` con
symlinks en `/usr/local/bin`.

**División del trabajo entre dos conversaciones.** El SQL, las políticas RLS,
las funciones de Supabase y los workflows de n8n se trabajan en un chat
aparte. El panel React se trabaja en Claude Code. Documentado en el v6 del
documento de estado, sección 11 (no localizado en este equipo al momento de
escribir esta entrada; solo se encontraron v4 y una versión sin numerar en
`~/Downloads/`).

**7 de septiembre de 2026 — Sobre el precio del sistema, si se llegara a
vender.** El costo real por cliente es de $1,500 a $2,500 MXN al mes contando
infraestructura y tiempo de soporte, así que una mensualidad por debajo de
$3,000 no deja margen. Los rangos que se manejaron fueron $35,000-60,000 de
implementación más $4,000-7,000 mensuales para el sistema de ventas. Marcos
consideró que está alto para su etapa, y se acordó que el hueco real no es de
precio sino de no tener casos que enseñar. Nota: Meta dejaría de regalar los
mensajes de servicio el 1 de octubre de 2026, según análisis de terceros; esto
falta verificar contra la tarjeta de tarifas oficial de Meta para México.

**7 de septiembre de 2026 — `cotizaciones.fecha` sí existe.** Se decidió
usarla como fecha del documento del PDF, revirtiendo el cambio a `created_at`
del commit anterior (66c9029), que se había hecho siguiendo un documento
desactualizado. Verificado contra `information_schema` en el commit 4c7156b.
Ver la sección de trampas para el detalle.

## Cambios, por fecha

**8 de septiembre de 2026 — sesión de verificación y diseño, sin código.**
No hubo commits. Se verificaron los supuestos de la bitácora y de
`paso0-resultados.md` contra el código real de `src/`, y se detonó el diseño
de cobranza/recibos/agenda tras un caso real en el chat del bot: un cliente
aprobó una cotización y preguntó cuándo se le podía atender. Ver "decisiones
tomadas" para el detalle completo y "pendientes conocidos" para lo que sigue.

**7 de septiembre de 2026 — Arreglar los bugs que hacían que el panel
mintiera (commit c02ef44).** Revisión completa de las siete pantallas: no
agregó funciones, corrigió cosas que ya se intentaban hacer y fallaban en
silencio. Búsqueda por texto sin dígitos devolvía el catálogo completo en
clientes, prospectos y conversaciones. El saldo de facturas usaba `||` en vez
de manejar cero explícitamente, así que una factura pagada volvía a mostrar el
total como pendiente, y cobrar el anticipo no bajaba el saldo. El update de
órdenes mandaba la relación anidada `cotizaciones` y PostgREST lo rechazaba,
así que ningún botón de editar servía. Configuración hacía `UPDATE` sobre una
tabla vacía (cero filas afectadas, sin error) y decía "guardada
correctamente" sin guardar nada; además el anticipo por defecto decía 50%
cuando la regla del negocio es 70%, y se quitó el campo de API key del PAC
porque esa tabla se lee desde el navegador. "Ver conversación" en prospectos
llevaba a una lista vacía en vez de abrir la conversación del número.

**7 de septiembre de 2026 — El aviso de PDF desfasado ahora vive en la base
(commit c56a86d).** La columna `pdf_vigente` la pone en `false` el trigger al
cambiar partidas y n8n la regresa a `true` al generar el PDF. Antes la marca
solo duraba la sesión del navegador: al recargar se perdía y un PDF viejo
volvía a verse como vigente. En la tabla de cotizaciones, el icono del PDF
sale en ámbar cuando no corresponde a las partidas actuales.

**7 de septiembre de 2026 — Alta de cotizaciones desde el panel y corrección
de fechas (commit 4c7156b).** Se agregó el botón "Nueva cotización" (cliente,
solicitud opcional, con_iva); el folio y la fecha los asigna la base
(secuencia y `CURRENT_DATE`) para que no choquen con los que crea el bot. Solo
se ofrecen solicitudes sin cotización porque el índice
`cotizaciones_solicitud_uniq` permite una por solicitud. Se corrigió que
`cotizaciones.fecha` sí existe (ver decisiones) y que un `date` de Postgres
llega como cadena y el navegador lo interpretaba en UTC, mostrando el día
anterior. Se avisa en la pestaña de partidas y sobre el visor cuando el PDF ya
no corresponde a las partidas editadas.

**7 de septiembre de 2026 — Landing page de Zentec (commit 3d96189).** Piel
clara, opuesta a la del panel, agregada en `landing/` dentro del mismo repo.

**7 de septiembre de 2026 — Login, tema oscuro y las pantallas que faltaban
(commit 66c9029).** El panel no tenía autenticación y, con RLS ya activo en
Supabase, no mostraba datos. Se agregó login con Supabase Auth y lectura del
rol desde `perfiles` (tolerante a que la tabla no exista). Se destapó que el
evento de cambio de sesión se dispara en cada renovación de token y cada vez
que vuelve el foco a la pestaña: sin candado, repetía la consulta del perfil
cientos de veces (325 peticiones en una sesión). Se agregaron las pantallas de
conversaciones (sobre `bot_conversaciones`, porque la Cloud API de Meta no
tiene bandeja de entrada), prospectos con filtro de enfriamiento, detalle de
cotización en cajón lateral con PDF embebido, y el tablero con las cuatro
métricas del plan. Se estableció el tema oscuro con acento cian. `.env` salió
del índice de git, con `.env.example` en su lugar.

**10 de junio de 2026 — Panel Zentec inicial (commit f47b0c7).** Primera
versión del panel: estructura base y las siete pantallas sin autenticación ni
datos reales conectados todavía.

## Cosas que ya costaron tiempo

- **`cotizaciones.fecha` sí existe**, es un `date` con default `CURRENT_DATE`.
  Un documento decía que no, y por seguir ese documento el código se cambió a
  `created_at` en el commit 66c9029; hubo que revertirlo en 4c7156b tras
  verificar contra `information_schema`. Regla: ante contradicción entre
  documentos, gana lo verificado contra `information_schema`.
- **La tabla `productos` tiene más columnas de las documentadas**:
  `imagen_url`, `clave_sat`, `unidad_sat`, `activo`, `created_at`.
- **`cotizacion_productos` tiene `descripcion_extra`**, que no aparecía en
  ningún DDL revisado y es texto que sí se imprime en el PDF.
- **`"cualquierCosa".includes("")` es `true` en JavaScript.** Ese detalle
  rompió la búsqueda en tres pantallas (clientes, prospectos, conversaciones):
  al escribir texto sin dígitos, el filtro por teléfono dejaba pasar todas las
  filas.
- **Un `UPDATE` sobre una fila que no existe afecta cero renglones y no
  devuelve error.** Por eso la pantalla de configuración decía "guardada
  correctamente" sin haber guardado nada.
- **`0 || x` en JavaScript da `x`**, porque cero es falso. Por eso una factura
  pagada mostraba el total como saldo pendiente en vez de cero.
- **PostgREST rechaza un update que incluya relaciones anidadas.** Mandar la
  fila completa que devolvió un `select *, cotizaciones(...)` hacía que ningún
  botón de editar órdenes funcionara.
- **Un `date` de Postgres llega como `"2026-09-03"` y el navegador lo
  interpreta en UTC**, mostrando el día anterior si no se parte a mano.
- **Los documentos de estado se contradicen entre sí**, y además están
  repartidos en varias carpetas. La versión vigente es la v6 y vive en
  `~/Downloads/files/zentec-sistema-estado-v6.md`, no directamente en
  `~/Downloads/`, donde solo quedaron la v4 y una versión sin numerar. Buscar
  ahí y no encontrarla ya costó una vuelta. Cuando haya conflicto entre
  documentos, gana lo verificado contra `information_schema` o contra el
  propio código, y se anota aquí cuál ganó.

- **`max(folio)+1` en un folio de documento funciona con un usuario y falla
  con concurrencia.** Con n8n registrando pagos en paralelo, dos recibos
  pueden salir con el mismo folio a dos clientes distintos. Por eso el folio
  de recibo usa secuencia dedicada (8 de septiembre de 2026).
- **Una política RLS por join falla en filas huérfanas.** Un
  `exists (select 1 from cotizaciones where ...)` sobre una fila con
  `cotizacion_id` nulo devuelve falso: la fila queda invisible para todos,
  incluido su dueño. Por eso `empresa_id` se denormaliza en vez de derivarse
  por join (8 de septiembre de 2026).
- **Un `select` suelto sobre `configuracion` se rompe en silencio el día que
  se migre a `unique (empresa_id, clave)`:** empieza a devolver más de una
  fila y toma una al azar. Una factura calculada con el anticipo de otra
  empresa no da error visible, simplemente cobra mal. Por eso
  `crear_factura_de_orden` debe leer la configuración por una función
  auxiliar, no por un `select` directo (8 de septiembre de 2026).
- **Un recibo de pago no es un comprobante fiscal y no lo rige el SAT.** El
  PDF debe decirlo en una línea, o algún cliente lo va a presentar como si lo
  fuera (8 de septiembre de 2026).

## Pendientes conocidos

**8 de septiembre de 2026 — pendientes actualizados tras la sesión de
verificación y diseño, sin código.**

**Del lado de la base y n8n:** todo el documento nuevo
`~/Downloads/cobranza-recibos-y-agenda-para-el-chat.md` (columnas de cobranza
en `cotizaciones`, tabla `pagos` con secuencia de folios, trigger de
recálculo, funciones `registrar_pago` y `cancelar_pago`, `revoke`/`grant`,
columnas de agenda en `ordenes_trabajo`, especificación del webhook de
correo), más lo que ya venía pendiente: `crear_orden_de_cotizacion`, el
default de 70% en `facturas.porcentaje_anticipo`, la fila `anticipo_default`
en `configuracion` (nota: `Configuracion.jsx:22` ya la tiene cableada del lado
del panel, falta del lado de la base), y la consulta de verificación de
políticas para `anon` (debe devolver cero filas, sigue sin correrse). El
vocabulario de estados con CHECK y las columnas `aprobada_at` /
`rechazada_at` / `motivo_rechazo` ya no están en esta lista: se verificaron
contra el código el 8 de septiembre y coinciden.

**Punto de pausa marcado en el documento nuevo:** la consulta 4 de
`paso0-resultados.md` lista qué funciones `bot_*` tocan `facturas` o
`cotizaciones`. Si alguna escribe en `facturas`, hay que parar antes de crear
el trigger de recálculo y avisar.

**Advertencia operativa:** el paso 5 del documento nuevo (los `revoke`) rompe
a propósito la pantalla de Facturas del panel. Dejará de guardar hasta que se
reescriba para llamar a `registrar_pago`. Está avisado, no debe leerse como
una falla cuando ocurra.

**Del lado del panel (Claude Code), en orden de urgencia:** conectar
`crear_orden_de_cotizacion` y quitar la opción "Sin cotización" de
`Ordenes.jsx:108` — marcado como lo más urgente por el arquitecto, porque un
cliente real ya aprobó una cotización y preguntó cuándo se le podía atender;
pantalla de cobranza sobre `cotizaciones` + `pagos`; reescribir
`Facturas.jsx`; calendario semanal de `ordenes_trabajo`; botón de enviar
recibo; limpiar el filtro por `'terminada'` en `Dashboard.jsx:81` (estado
fantasma, no existe en el CHECK de `ordenes_trabajo`, hoy inofensivo porque no
hay filas con ese valor).

**Preguntas abiertas para Marcos:** el plazo real de vencimiento de factura
(los 30 días son un supuesto heredado, sin verificar); si el recibo lleva logo
y datos fiscales o basta con folio, monto, concepto y método.

**Supuesto marcado como tal:** el `check (monto > 0)` en `pagos` asume que no
hay notas de crédito ni devoluciones. Si alguna vez se devuelve dinero a un
cliente, ese check lo impide; se dejó estricto a propósito, revisar si cambia
la operación.

**Sin verificar, inferido, pendiente de confirmar en la base:** el tipo real
de `ordenes_trabajo.fecha_inicio`/`fecha_fin` (si son `timestamptz`,
`hora_inicio` sobra); si `ordenes_trabajo.cotizacion_id` es nullable; si
`clientes.email` es nullable; si el correo de Zentec tiene SPF/DKIM
configurados.

**Botón de reenviar cotización por WhatsApp:** no se conecta hasta que exista
plantilla aprobada por Meta (ver decisiones). Mientras tanto queda el enlace
wa.me.

**Repo del panel de agenda:** no se ha creado todavía; se decidió que va
aparte del panel de Zentec (ver decisiones).

**Push a remoto:** los seis commits del panel son locales, no se ha hecho
`git push`.

**Verificación pendiente:** la fecha del 1 de octubre de 2026 en que Meta
dejaría de regalar mensajes de servicio, contra la tarjeta de tarifas oficial
de Meta para México.
