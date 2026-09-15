# Bitácora del sistema Zentec

## Estado actual

**16 de septiembre de 2026 — quedó construida la pantalla Agenda y conectado
el botón que genera la orden desde una cotización aprobada.** Verificado por
Claude Code contra el código y contra producción. `src/pages/Agenda.jsx`
(ruta `/agenda`, entrada en el menú) muestra la semana en columnas por día —no
rejilla por hora, porque con pocas visitas al día queda casi en blanco—, con
navegación de semanas, alta/edición de visitas con o sin orden, técnicos por
visita y bitácora de eventos que solo se agregan. En Cotizaciones, el cajón de
una cotización aprobada sin orden ofrece "Generar orden", que llama a
`crear_orden_de_cotizacion` en vez de insertar directo en `ordenes_trabajo`.
En Órdenes se quitó "Sin cotización" también al editar. Todo está en
`origin/main` y Marcos lo desplegó con rsync: `/agenda` responde 200, el JS
servido (`index-CjNbMJuJ.js`) contiene `visita_tecnicos` y
`crear_orden_de_cotizacion`, y ya no contiene "Sin cotización". Sin probar
contra la base real: la asignación de técnicos y la bitácora dentro de una
visita guardada, y cualquier escritura (crear visita, técnico, evento, generar
orden); no se creó nada de prueba a propósito porque las visitas no se pueden
borrar. Lo prueba Marcos.

**15 de septiembre de 2026 — se cerraron tres huecos de seguridad abiertos al
público y quedó creada la agenda de servicios.** `bot_ventas` y
`recordatorios` estaban sin RLS con permisos completos para `anon`: datos
personales de prospectos legibles y borrables desde internet. Treinta
funciones eran ejecutables sin sesión iniciada, entre ellas
`marcar_pdf_generado`, que permitía apuntar el PDF de cualquier cotización a
un archivo ajeno. Y el registro público de usuarios estaba encendido. Los tres
cerrados y verificados; `auth.users` sigue en 1, nadie se coló. El bot se
probó después de los cambios y contesta. Se crearon `tecnicos`, `visitas`,
`visita_tecnicos` y `visita_eventos`. Ese día el panel no se tocó desde el
otro chat. **Corrección del 16 de septiembre:** esta entrada decía que
producción seguía con la versión del 7; es falso. El 14 se desplegaron y
verificaron contra producción Órdenes, Prospectos y el tema claro (ver la
entrada del 14). El otro chat no podía saberlo. La entrada citaba un detalle
en `~/Downloads/bitacora-15-septiembre.md`, que no existe.

**15 de septiembre de 2026 — corrección importante: `crear_orden_de_cotizacion`
SÍ existe en la base.** Verificado contra `pg_proc`. Las entradas del 10 y del
14 de septiembre decían lo contrario y estaban mal: se dedujo de que
`grep -rn "\.rpc(" src` devolviera cero, que solo prueba que el panel no la
llama. Nunca se comprobó contra la base. La función es `security definer`, con
`search_path` fijo, sin permiso de ejecución para `anon`, valida que la
cotización exista, esté `aprobada` y no tenga ya una orden. O sea que el
objetivo "de la cotización aprobada a la orden agendada" **no está bloqueado
del lado de la base**: lo único que falta es conectar el botón en el panel.

**14 de septiembre de 2026 (cierre del día) — producción ya no es la del 7 de
septiembre; esto reemplaza el párrafo siguiente.** Se desplegaron tres
commits más: `b9aea4a` (bitácora), `667542b` (Órdenes ya no se crea sin
cotización) y `d1f1e9f` (tema claro). Verificado contra el JS/CSS servidos en
producción. Además, en sesión con el arquitecto se revirtió la decisión del 8
de septiembre "la orden es la cita" y se diseñaron tres piezas nuevas que
todavía no existen en la base: la tabla `visitas` (agenda de servicios, no
solo instalaciones), el control de usuarios vía Edge Function, y la firma de
conformidad del cliente. Ninguna de las tres está construida; ver
"Decisiones tomadas" y "Pendientes conocidos".

**14 de septiembre de 2026 — la alerta de solicitud lista está armada y sin
probar.** Cuatro nodos nuevos en `zentec-bot-final` colgando de `Guardar
Venta`, más la columna `bot_solicitudes.alertada_at`. No se ha ejecutado ni
una vez: falta que Meta apruebe la plantilla `solicitud_lista`, enviada a
revisión hoy. El panel no se tocó y producción sigue con la versión del 7 de
septiembre. Evolution quedó desactivado; todo entra por Meta, lo que significa
que ya no existe ninguna salida para mensajes libres fuera de la ventana de 24
horas. Detalle completo en `~/Downloads/alerta-solicitud-lista-para-el-chat.md`.

**10 de septiembre de 2026 — la pantalla de Prospectos ya no miente sobre la
antigüedad.** Es el único cambio de código del día y está commiteado local
(`9433f54`), sin desplegar: producción sigue con la versión del 7 de
septiembre hasta que se corra el `rsync`. Del lado de la base no se aplicó
nada: el objetivo "de la cotización aprobada a la orden agendada" sigue sin
empezar, y `grep -rn "\.rpc(" src` sigue devolviendo cero. Lo que sí se cerró
es la consulta de políticas para `anon`, pendiente desde el 7 de septiembre:
devolvió cero filas.

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

**16 de septiembre de 2026 — si se usa el conector de Supabase desde Claude
Code, es solo lectura; el esquema se sigue cambiando únicamente desde el otro
chat.** Marcos activó el conector también en Claude Code; en la sesión del 16
apareció como "pending" y no llegó a dar herramientas, así que no se probó si
de verdad respeta ese límite. Acordado para mantener la división de trabajo ya
registrada (7 de septiembre): SQL y RLS en un chat, panel en el otro.

**14 de septiembre de 2026 — se revierte "la orden es la cita" (decisión del
8 de septiembre).** Razón nueva: Marcos quiere una agenda de servicios en
general, y hay citas que no nacen de una cotización (levantamiento antes de
cotizar, garantía). La orden sigue naciendo de una cotización y es lo que se
vendió; la cita en el calendario es la **visita**, tabla propia `visitas`
(tipo levantamiento/instalación/mantenimiento/garantía/soporte, inicio y fin
`timestamptz`, estado programada/en_curso/realizada/cancelada/reprogramada,
`orden_id`, `cliente_id` y `solicitud_id` opcionales con CHECK de que haya
cliente o solicitud). Una instalación de tres días son varias visitas. Esto
cancela el §4 de `pendientes-9sep-para-el-chat.md` (columnas
`hora_inicio`/`duracion_min`/`tecnico_id` en `ordenes_trabajo`, que databa
del 8 de septiembre).

**14 de septiembre de 2026 — los técnicos se asignan a la visita, no a la
orden.** Marcos quiere que una orden pueda tener varios técnicos, y cada día
de una instalación puede llevar gente distinta. Tabla `visita_tecnicos`
(rol responsable/apoyo). `tecnicos` queda separada de `perfiles`, con
`perfil_id` opcional, para poder agendar a un ayudante sin cuenta en el
sistema.

**14 de septiembre de 2026 — el seguimiento de una visita es por eventos, no
por edición.** Tabla `visita_eventos` (avance/incidencia/material/cierre,
nota, autor, fecha) que no se edita ni se borra. Cuelga de la visita, no de
la orden, para que un mantenimiento o una garantía sin orden también tengan
bitácora.

**14 de septiembre de 2026 — un servicio cobrable necesita cotización.** Un
mantenimiento o soporte que se cobra se cotiza con un producto de catálogo
tipo "Servicio de mantenimiento". Levantamiento y garantía van sin
cotización porque no se cobran.

**14 de septiembre de 2026 — la agenda de servicios va antes que la
cobranza.** Decisión de Marcos; invierte el orden de urgencia que traía la
lista de pendientes desde el 8 de septiembre (ahí "conectar
`crear_orden_de_cotizacion`" y la pantalla de cobranza iban antes que el
calendario). Advertencia del arquitecto: esto deja más tiempo abierto la
ventana de que `Facturas.jsx` siga escribiendo el saldo desde el navegador
(ver decisión del 8 de septiembre sobre `Math.max(total - anticipo, 0)`);
tolerable solo mientras siga habiendo un único usuario del panel.

**14 de septiembre de 2026 — control de usuarios por Edge Function, no desde
el navegador ni desde n8n.** Marcos quiere poder dar de alta usuarios desde
el panel. Diseño: un apartado Usuarios solo para admin llama a una
**Supabase Edge Function** con la sesión; la función verifica el token con
`auth.getUser`, confirma que quien llama sea admin activo, toma `empresa_id`
del perfil de quien invita (nunca del body), valida rol y correo, invita con
la service role key —secreto de Supabase, nunca en el navegador— y crea el
perfil; si crear el perfil falla, borra el usuario recién invitado. Se
desactiva en vez de borrar, bloqueando también la cuenta; nadie puede
desactivarse a sí mismo ni dejar una empresa sin admin. Se prefirió Edge
Function sobre n8n porque valida la sesión de forma nativa, la llave queda
como secreto de Supabase y no depende del VPS; y porque en n8n ya se filtró
el token de Meta (ver "Cambios, por fecha" del 14 de septiembre, la primera
entrada). Nadie edita `perfiles` desde el navegador —un vendedor podría
ponerse admin—. Roles: admin/vendedor/técnico; quien registra un pago no
puede cancelarlo (separación de funciones sobre el pago); el técnico no lee
tablas de precios sino una función `agenda_tecnico` sin precios, porque las
políticas RLS filtran filas, no columnas. `bot_admins` sigue siendo una
tabla separada de `perfiles`. La migración agrega las políticas nuevas junto
a las `using (true)` existentes y va quitando las viejas tabla por tabla,
porque si una política queda mal el panel no marca error: muestra tablas
vacías, y eso pasa desapercibido.

**14 de septiembre de 2026 — firma de conformidad del cliente en sitio,
desde el celular del técnico.** Pedido de Marcos. Depende del control de
usuarios, aunque se puede construir antes usando la cuenta de Marcos. Se
descartó un enlace de un solo uso sin cuenta. Diseño: bucket privado
`firmas` sin permiso de modificar ni borrar (una firma mal puesta se anula
con motivo y se firma de nuevo), `texto_aceptado` guardado junto con la
firma, fecha tomada del servidor y no del celular, y una función
`completar_orden` que exige firma o motivo de admin para saltarla. La imagen
de la firma es dato personal y hay que mencionarla en el aviso de
privacidad.

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

**16 de septiembre de 2026 — tres commits: botón "Generar orden", "Sin
cotización" fuera también al editar, y la pantalla Agenda.**

`fc9e64a`, Cotizaciones: el cajón de una cotización aprobada sin orden ofrece
"Generar orden", que llama a `crear_orden_de_cotizacion` — el panel deja de
insertar directo en `ordenes_trabajo` para este flujo. Si la cotización ya
tiene orden, el cajón muestra su estado y un enlace a Órdenes en vez del
botón; si no se pudo consultar si ya existe una orden, no se ofrece el botón,
para no invitar a crear una segunda. Si la llamada a la función falla, se
muestra el error que devuelve la base y se vuelve a consultar el estado.

`cf103bc`, Órdenes: se quitó la opción "Sin cotización" también al formulario
de edición, no solo al de alta (`667542b`, 14 de septiembre). Razón: la base
ya exige `cotizacion_id not null` con índice único, así que dejar la opción
en edición solo generaba un error de la base en vez de explicar por qué no se
puede.

`e98709f`, pantalla **Agenda** (`src/pages/Agenda.jsx`, ruta `/agenda`, con
icono de calendario en el menú). Semana en columnas por día, no rejilla por
hora: se descartó la rejilla porque con pocas visitas al día queda casi en
blanco. Navegación entre semanas y botón "Hoy", día actual resaltado, color
por tipo de visita, canceladas ocultables. Alta y edición de visitas con o sin
orden; si se elige una orden, el formulario toma el cliente y la dirección de
su cotización y cambia el tipo de levantamiento a instalación. Validaciones
en el panel antes de enviar a la base: que el fin sea después del inicio, y
que haya cliente o solicitud. Técnicos por visita con rol
responsable/apoyo, con aviso si no queda nadie como responsable. Bitácora de
eventos por visita que solo se agregan, nunca se editan ni se borran —refleja
del lado del panel lo que la base ya impedía con `revoke` desde el 15 de
septiembre—. Catálogo de técnicos en un modal aparte: se desactivan, no se
borran; el teléfono se valida a 10 dígitos. Las visitas no tienen botón de
borrar en ninguna pantalla. `visitas.inicio`/`visitas.fin` son `timestamptz`
y el formulario convierte con la hora del navegador.

Los tres commits están en `origin/main`. Marcos desplegó con rsync y se
verificó contra producción: sirve `index-CjNbMJuJ.js` / `index-BbdDyiWE.css`
(iguales al `dist/` local), `/agenda` responde 200, el JS contiene
`visita_tecnicos` y `crear_orden_de_cotizacion`, y ya no contiene "Sin
cotización".

**Verificaciones contra la base, hechas por Marcos con una consulta directa y
usadas para revisar el trabajo del panel:** la firma de
`crear_orden_de_cotizacion(p_cotizacion_id uuid, p_descripcion text)`
coincide con lo que llama el botón nuevo. El esquema de `tecnicos`, `visitas`,
`visita_tecnicos` y `visita_eventos`, contra `information_schema`,
`pg_constraint` y `role_table_grants`, coincide columna por columna con
`agenda-seguridad-para-el-chat.md`: `empresa_id` con default
`f099fe69-ae88-4e09-aa4e-3198b5d72cc4`, y `authenticated` sin DELETE en
`visitas` ni UPDATE/DELETE en `visita_eventos`, tal como se diseñó.

**Agenda probada en el navegador local, con la sesión de Marcos contra la
base real, solo lectura.** Las cinco consultas de la pantalla responden 200,
incluida la de visitas con técnicos, cliente, orden y solicitud anidados; los
selectores traen 1 orden abierta, 10 clientes y 15 solicitudes; guardar sin
cliente ni solicitud muestra el aviso y no manda ninguna petición a
`visitas`; se revisó en tema claro y oscuro. Las funciones de fecha se
probaron con `TZ=America/Mexico_City`, incluidos un domingo y las 23:30. Sin
probar: la sección de técnicos y la bitácora dentro de una visita ya guardada,
cualquier escritura (crear visita, técnico o evento) y el botón "Generar
orden" contra la base real — no se creó nada de prueba a propósito, porque las
visitas no se pueden borrar y una de prueba quedaría para siempre.

**Hallazgo, para el otro chat, sin resolver aquí:** `authenticated` tiene
TRUNCATE en `tecnicos`, `visitas`, `visita_tecnicos` y `visita_eventos`.
PostgREST no expone TRUNCATE, así que no se puede disparar desde el panel, y
no es urgente por eso — pero contradice la decisión del 14 de septiembre de
que "las visitas no se borran". Queda como pregunta abierta, no resuelta.

Aparte, los 404 a `perfiles` que se ven en la consola del panel son
esperados: la tabla no existe todavía y `AuthContext` ya está escrito para
tolerarlo (ver la entrada del 7 de septiembre sobre el login).

**15 de septiembre de 2026 — paso 0 de seguridad, limpieza de
`ordenes_trabajo` y tablas de la agenda.** Sin commits: todo es base de datos
y configuración de Supabase. La tanda venía de
`~/Downloads/agenda-seguridad-para-el-chat2.md`.

Se conectó el conector oficial de Supabase, que cambia cómo se trabaja: se lee
el esquema directo en vez de copiar y pegar consultas. Los advisors de
seguridad de Supabase fueron los que destaparon los huecos, y llevaban ahí
desde siempre sin que nadie los mirara.

**Huecos cerrados.** RLS y `revoke` en `bot_ventas` y `recordatorios`, que
estaban abiertas a `anon` con permisos completos y 3 filas de datos personales
adentro. `revoke execute` en las 30 funciones que `anon` podía ejecutar — la
peor, `marcar_pdf_generado`. Y apagado el registro público de usuarios en
Supabase Auth.

**`ordenes_trabajo`.** Se borraron `hora_inicio`, `duracion_min` y
`tecnico_id`, que sí se habían aplicado pese a lo que decía la bitácora y que
el modelo nuevo deja sin sentido. Ninguna tenía dato puesto por nadie —ojo:
`duracion_min` tenía `default 120`, así que todas las filas la traían llena
sola, que es peor que vacía—. `estado` y `cotizacion_id` pasaron a `not null`,
y se agregó índice único en `cotizacion_id` porque la regla "una cotización,
una orden" vivía solo dentro de una función, con rendija de concurrencia.

**Agenda.** Creadas `tecnicos`, `visitas`, `visita_tecnicos` y
`visita_eventos`. La orden es lo que se vendió; la visita es la cita y puede
existir sin orden. Los técnicos se asignan a la visita, no a la orden. Las
visitas no se borran y los eventos no se editan: la base lo impide con
`revoke`, no solo la interfaz. Se agregaron cuatro `revoke all from anon` que
no traía el documento original, porque Supabase otorga permisos a `anon` en
toda tabla nueva de `public` — así nacieron los dos huecos de arriba.

**14 de septiembre de 2026 (cierre del día) — tres commits desplegados y
diseño de agenda/usuarios/firma con el arquitecto.**

`b9aea4a`: entradas de bitácora del 10 al 14 de septiembre que estaban sin
commitear. Para poder commitear hubo que borrar un `.git/index.lock`
huérfano (ver "Cosas que ya costaron tiempo").

`667542b`, Órdenes: ya no se puede crear una orden sin cotización. La opción
"Sin cotización" queda deshabilitada al crear, con el aviso "Selecciona la
cotización aprobada de la que sale la orden". Razón: sin cotización no hay
dónde colgar el cobro (ver la decisión "un servicio cobrable necesita
cotización"). Dos excepciones deliberadas: las órdenes viejas que ya no
tienen cotización se pueden seguir editando —si no, quedarían congeladas,
sin poder ni cambiarles el estado—; y si la cotización de una orden dejó de
estar aprobada, se sigue mostrando en el selector, porque el selector solo
lista aprobadas y antes esa orden se veía con el campo en blanco. Verificado
en producción (el JS servido contiene el aviso) y por Marcos en pantalla.

`d1f1e9f`, tema claro: selector Auto / Claro / Oscuro en el sidebar. Auto
sigue el tema del sistema operativo y reacciona si cambia. La elección se
guarda en `localStorage` del navegador, no en la base, porque no es un dato
del negocio. Un script en `index.html` aplica el tema en `<html
data-tema>` antes de que React pinte, para que no parpadee en oscuro al
cargar. Nuevo `src/lib/tema.js` (hook `useTema`). Los colores que en
`src/index.css` estaban fijos para fondo oscuro (fondo de campos, badge
gris, scrollbar, sombras) pasaron a variables `--campo-bg`, `--campo-bg-2`,
`--gris-bg`, `--scroll`, `--scroll-hover`, `--sombra`; el tema claro solo
redefine esas variables bajo `:root[data-tema="claro"]`. En claro el cian se
oscurece a `#0891b2` con texto blanco en el botón principal, porque ni el
cian claro sobre blanco se lee bien ni el texto oscuro original se lee sobre
cian oscuro. Verificado en el navegador local (sidebar, tabla, las cinco
etiquetas de color, avisos, botones y campos, en los dos temas; oscuro salió
idéntico a antes) y en producción (los assets servidos coinciden con el
build local, y el HTML/JS/CSS contienen el selector y la regla de tema
claro). Marcos hizo el push y el `rsync`. **Sin verificar todavía:**
pantallas con sesión iniciada, sobre todo Conversaciones y el cajón de
Cotizaciones, que tienen estilos propios.

Con esto, producción sirve el build con Órdenes exigiendo cotización,
Prospectos con la antigüedad corregida y el tema claro; todo lo anterior
está en `origin/main`.

En la misma sesión, con el arquitecto y sin tocar código, se diseñaron tres
piezas que reemplazan y extienden decisiones previas: la tabla `visitas`
para la agenda de servicios (revierte "la orden es la cita" del 8 de
septiembre), el control de usuarios vía Edge Function, y la firma de
conformidad del cliente. Ver "Decisiones tomadas" para el detalle de cada
una. El producto de esa parte de la sesión es
`~/Downloads/agenda-seguridad-para-el-chat.md`, con un paso 0 de seguridad
(rotar el token de Meta, revisar si el registro de usuarios está abierto en
Supabase Auth, revisar y revocar `execute` de funciones `security definer`),
un paso 1 de verificaciones (V1 a V12) y un paso 2 con el SQL de `tecnicos`,
`visitas`, `visita_tecnicos` y `visita_eventos`.

**14 de septiembre de 2026 — alerta a WhatsApp cuando una solicitud queda
lista.** Sin commits: todo es base, n8n y Meta.

En la base, `bot_solicitudes` ganó `alertada_at timestamptz`. Existe por una
sola razón: `bot_upsert` corre con cada mensaje del cliente, y una solicitud
que ya quedó en `cerrada` sigue cerrada, así que sin esa marca llegaría una
alerta por cada mensaje posterior. El último nodo la sella con `now()` y la
consulta de lectura solo devuelve filas donde siga en null.

En n8n, cuatro nodos colgados de `Guardar Venta` **en paralelo** a `Cotizar?`,
no en serie: cotizar y alertar son independientes y si uno falla el otro debe
salir igual. `Leer Solicitud para Alerta` → `Limpiar para plantilla` →
`Alertar a Marcos` → `Marcar alertada`.

Decisiones que tienen razón y no deben deshacerse por parecer de más: los
datos de la alerta salen de `bot_solicitudes`/`bot_prospectos` y no del objeto
del extractor, porque ese objeto es lo que el modelo creyó entender y la fila
es lo que quedó guardado; los `coalesce` con `nullif` están porque Meta
rechaza un parámetro vacío y una cadena `''` tumbaría el envío entero; el
número del destinatario sale de `bot_admins` con un subselect en vez de ir
escrito en el nodo; y el nodo Code lleva dos funciones de teléfono que hacen lo
contrario a propósito —una arma el número a donde va la alerta, la otra limpia
el número que se lee dentro de ella—.

`Marcar alertada` lee su parámetro con `$('Limpiar para plantilla')` y no con
`$json`, porque en ese punto `$json` trae la respuesta de Meta. Eso lo ata al
nombre exacto de ese nodo: renombrarlo lo rompe.

En Meta quedó enviada a revisión la plantilla `solicitud_lista`, categoría
Servicio, `es_MX`, cuatro variables numeradas, sin encabezado ni pie ni
botones.

**10 de septiembre de 2026 — Prospectos: la antigüedad cuenta desde el último
mensaje (commit `9433f54`).** Marcos reportó que la pestaña de Prospectos no
se movía aunque la clienta Fernanda hubiera escrito: la actividad solo se veía
en Conversaciones. La causa se verificó en el código, no se supuso.
`Prospectos.jsx` calculaba la antigüedad con `s.updated_at || s.created_at` de
`bot_solicitudes` y nunca consultaba `bot_conversaciones`, así que la columna
"Sin moverse" solo reaccionaba a cambios en la solicitud —servicio, etapa,
dirección— y no a los mensajes.

Ahora `cargar()` trae también `bot_conversaciones`, y la fecha de cada fila es
el movimiento más reciente venga de donde venga: un mensaje del cliente, una
respuesta del bot o un cambio en la solicitud. Eso alimenta las tres cosas a
la vez —la columna, el filtro "Se enfrían" y su conteo—, así que no pueden
volver a discrepar entre sí. Las filas cuyo último mensaje es del cliente
llevan un badge ámbar **espera**: separa "te están esperando" de "ya no
contestó", que es la diferencia accionable.

Tres detalles del cómo, con su razón, para que nadie los borre pensando que
sobran:

- El enlace es por `solicitud_id`, y el teléfono queda solo de respaldo para
  los mensajes que vengan sin etiquetar (los anteriores a que la solicitud
  existiera). Esos se le acreditan a la solicitud **más reciente** de esa
  persona. Sin esa regla, un cliente con dos solicitudes vería el badge
  "espera" en las dos y una de ellas inventaría trabajo pendiente.
- El `select` pide solo `numero, rol, created_at, solicitud_id`, no `*`: son
  1000 filas y bajar el cuerpo de cada mensaje para leer una fecha es caro sin
  ganar nada.
- Si `bot_conversaciones` falla, la pantalla lo dice con una alerta y los
  prospectos igual cargan. Callarlo dejaría días cortos en silencio, que es
  exactamente la clase de mentira que se corrigió el 7 de septiembre.

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

**El editor SQL de Supabase solo muestra el resultado del último `select`.**
Pegar varias consultas de verificación juntas y correrlas de una vez devuelve
solo la de hasta abajo; las anteriores se pierden sin avisar que no se
mostraron. La solución usada el 16 de septiembre fue juntar todo en un
`select json_build_object(...)` que devuelve una sola celda con todos los
resultados adentro.

**Revocar a `anon` no sirve si el permiso viene de `PUBLIC`.** El ACL muestra
`=X/postgres`: esa entrada sin nombre delante es `PUBLIC`, todos los roles, y
`anon` hereda de ahí. Postgres otorga `EXECUTE` a `PUBLIC` en toda función
nueva. Hay que revocarle a `PUBLIC` explícitamente. Un `revoke ... from anon`
solo, no cambia nada y parece que sí.

**Supabase otorga permisos a `anon` en toda tabla nueva de `public`.** Por eso
una tabla creada sin pensarlo nace legible desde internet. Toda tabla nueva
lleva RLS activado **y** `revoke all from anon`.

**Un `CHECK` deja pasar `NULL` por definición.** Una columna con CHECK de
valores válidos pero nullable acepta nulos, y esa fila no aparece en ningún
filtro por ese campo.

**Una columna nueva con `default` llena todas las filas existentes.** Queda un
dato que nadie puso y que se ve verdadero. Para saber si alguien la usó de
verdad hay que contar con `filter (where col is distinct from <default>)`, no
con `count(col)`.

**Cada mitad solo afirma lo que puede comprobar.** Claude Code verifica el
panel y producción (git, curl sobre los archivos servidos); el otro chat
verifica la base (conector de Supabase, `pg_proc`, `information_schema`). Lo
que una mitad dice de la otra se escribe como "según X, sin verificar", y así
se copia a la bitácora. Casi todas las contradicciones de esta bitácora
salieron de afirmar sobre la mitad ajena: el 9 Claude Code dio por inexistente
una función por un grep del panel; el 11 Watson dio por no subido un commit que
sí estaba; el 15 el otro chat dio producción por la del 7 sin saber de los
despliegues del 14 (regla fijada el 16 de septiembre).

**`grep` sobre el panel no prueba nada sobre la base.** Que `grep -rn "\.rpc("
src` devuelva cero significa que el panel no llama funciones, no que las
funciones no existan. Confundirlo costó dos entradas de bitácora equivocadas.

**Un `.git/index.lock` huérfano bloquea todos los commits sin avisar la
causa real.** El mensaje dice "another git process seems to be running", que
suena a que hay que esperar. El del 14 de septiembre estaba vacío, era del
10 de septiembre a las 14:08 y no había ningún proceso git corriendo: lo
dejó un proceso caído, no uno en marcha. Antes de borrarlo hay que
comprobar dos cosas, `pgrep -fl git` (que no haya proceso) y la fecha del
archivo (que no sea de hace segundos); si las dos cuadran, se borra con `rm
-f .git/index.lock` y el commit sigue. Nota: esto es distinto de la trampa
ya registrada del shell de Claude en la nube, que deja el lock por no poder
borrar archivos montados; este lock apareció en la Mac de Marcos.

**La regla de los teléfonos a 10 dígitos es falsa para las tablas `bot_*`.**
El arranque dice "los teléfonos se guardan a 10 dígitos; WhatsApp necesita 521
+ esos 10". Vale para el resto del sistema, pero `bot_prospectos.numero` y
`bot_admins.numero` guardan los **13** completos, con el `521` incluido.
`Prospectos.jsx` lo tolera de rebote con `numero.length === 10 ? '521' +
numero : numero`. Una consulta nueva que siga la regla al pie de la letra
devuelve cero filas.

**El lenguaje comercial tumba una plantilla de Servicio en Meta.** El primer
texto de `solicitud_lista` decía "Nueva solicitud lista para cotizar" y el
clasificador lo marcó antes de enviarlo: recomendó Marketing y avisó que sería
rechazada. Redactada como actualización de cuenta pasó. Servicio es para
mensajes sobre la cuenta o el pedido de quien los recibe.

**Ser administrador en `bot_admins` no abre la ventana de 24 horas de Meta.**
Las validaciones del `Modo Admin?` son autorización dentro de Zentec; para Meta
el número personal de Marcos es un usuario más. Confundir las dos cosas llevó a
un razonamiento equivocado que hubo que corregir a media sesión.

**En WhatsApp Manager, la categoría Utilidad aparece como "Servicio".** La
documentación de Meta le dice Utility. Es la misma.

**El shell de Claude en la nube no puede correr `npm run build` de este
repo.** `node_modules` tiene los binarios de macOS (`@rollup/rollup-darwin-x64`)
y ese shell es Linux, así que rollup truena con `Cannot find module
@rollup/rollup-linux-x64-gnu`. No es el bug de dependencias opcionales de npm
que sugiere el mensaje y **no** hay que reinstalar nada: el `node_modules` está
bien, es de otra plataforma. La verificación de sintaxis se hizo pasando el
archivo por esbuild, y el build real lo corre Marcos en su terminal.

**Consultar el estado de git desde el shell de Claude deja un
`.git/index.lock` atorado.** Ese shell no tiene permiso para borrar archivos en
las carpetas montadas, así que el lock que git crea y normalmente borra se
queda. El siguiente `git commit` falla hasta que se corre `rm -f
.git/index.lock`. Conviene que las operaciones de git las haga Marcos desde su
terminal.

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
- **La trampa de Homebrew NO es exclusiva de Node.** El documento de arranque
  la registraba solo para `brew install node`. Instalar `gh` en esta Mac Intel
  con macOS 26 hizo exactamente lo mismo: no hay paquete precompilado para
  esta combinación, así que Homebrew bajó **Go** como dependencia, lo compiló
  desde fuente (4 min 42 s) y luego compiló `gh`. Se predijo que `gh` no
  caería en la trampa y sí cayó. Regla nueva: en esta Mac, **cualquier**
  `brew install` puede terminar compilando desde fuente. Dar por hecho que
  tarda, no que es instantáneo (8 de septiembre de 2026).
- **`gh` necesita los alcances `repo` Y `read:org`; `git push` solo necesita
  `repo`.** Por eso un token con solo `repo` sube ramas perfectamente pero
  falla en `gh auth login` con `error validating token: missing required
  scope 'read:org'`. Confunde porque el push ya había funcionado. El token
  classic se edita y conserva su valor: basta marcar `read:org` y darle
  Update token, sin generar uno nuevo. `workflow` aparece en el mensaje de
  ayuda de `gh` pero solo hace falta para modificar workflows de Actions
  (8 de septiembre de 2026).
- **Git no tenía identidad configurada en esta Mac.** Sin `user.name` ni
  `user.email`, los siete primeros commits quedaron firmados como
  `Marcos <macbook@192.168.1.8>` — una dirección derivada del nombre de la
  máquina. GitHub no puede ligarlos a la cuenta `zerkx44-lgtm`, así que
  aparecen sin foto ni enlace al perfil. Se corrige para los commits futuros
  con `git config --global user.email`; reescribir los viejos cambiaría todos
  los hashes y no vale la pena por algo cosmético (8 de septiembre de 2026).

## Pendientes conocidos

**16 de septiembre de 2026.**

**Cerrado hoy, del lado del panel:** el botón "Generar orden" en Cotizaciones
y "Sin cotización" fuera del editor de Órdenes (ver "Cambios, por fecha"). La
pantalla Agenda quedó construida y desplegada.

**Para Marcos:** probar en producción el flujo completo — generar la orden
del cliente que aprobó su cotización, dar de alta técnicos, crear la visita
de instalación ligada a esa orden, asignarle técnicos y registrar un evento
en su bitácora. Es lo único que falta para cerrar "el cliente que aprobó su
cotización el 8 de septiembre sigue sin fecha de instalación" (pendiente
abierto desde el 14).

**Para el otro chat:** sigue pendiente rotar el token de Meta (lo más urgente
desde el 14); revocar TRUNCATE en `tecnicos`, `visitas`, `visita_tecnicos` y
`visita_eventos` (hallazgo del 16, contradice "las visitas no se borran");
confirmar si ya se aplicaron los `revoke` de saldo en `facturas`/
`cotizaciones`, porque de eso depende si `Facturas.jsx` todavía guarda o si
choca con `recalcular_cobranza` (que `pagos` y sus funciones existan lo
dice el otro chat; Claude Code no lo ha verificado); crear `aprobada_at`/`rechazada_at`/
`motivo_rechazo` en `cotizaciones` (sigue sin existir, ver entrada del 15).

**Para Claude Code:** pasar el alta de Órdenes a `crear_orden_de_cotizacion`
también en el flujo que hoy sigue insertando directo en `ordenes_trabajo`,
protegido por el índice único; después, el paquete de usuarios y la firma de
conformidad; luego la cobranza con `pagos` y reescribir `Facturas.jsx`.

**15 de septiembre de 2026.**

**Cerrado hoy:** todo el paso 0 de seguridad salvo el token de Meta, la
limpieza de `ordenes_trabajo`, las verificaciones V1 a V12 y las tablas de la
agenda.

**Corrección a esta lista, por segunda vez en dos días:** `crear_orden_de_cotizacion`
y la tabla `pagos` **ya existen**, con sus funciones `registrar_pago`,
`cancelar_pago`, `recalcular_cobranza` y `pagos_folio`. Estaban aquí como
pendientes. Hay que revisar qué más del diseño de cobranza está aplicado: la
base va por delante de los documentos.

**Agregado del lado de la base:** crear `aprobada_at`, `rechazada_at` y
`motivo_rechazo` en `cotizaciones`, que resultaron no existir; hacer que
`precio_unitario` lo ponga la base desde el producto y no el navegador; fijar
`search_path` en las 26 funciones que no lo traen; encender la protección de
contraseñas filtradas cuando entren más usuarios; e instalar `btree_gist` si
se quiere que la base impida empalmes de visitas.

**Pregunta abierta para Marcos:** el bucket `Productos` de storage es público.
Probablemente a propósito, porque las fotos van en los PDFs a clientes, pero
falta confirmarlo para anotarlo como decisión.

**14 de septiembre de 2026 (cierre del día) — lo que dejó la sesión de
agenda/usuarios/firma.**

**Cerrado de la lista de abajo:** "conectar `crear_orden_de_cotizacion` y
quitar la opción 'Sin cotización' de `Ordenes.jsx:108`" — la parte del panel
(quitar la opción, con sus dos excepciones) quedó hecha en `667542b` y
verificada en producción. La función `crear_orden_de_cotizacion` en la base
sigue pendiente, ahora del lado del otro chat.

**Para el otro chat, en orden:** todo `~/Downloads/agenda-seguridad-para-el-
chat.md` — paso 0 (rotar el token de Meta, que sigue siendo lo más urgente
desde la entrada de hoy más abajo; revisar si el registro de usuarios está
abierto en Supabase Auth; revisar y revocar `execute` de funciones
`security definer`), paso 1 (verificaciones V1 a V12) y paso 2 (SQL de
`tecnicos`, `visitas`, `visita_tecnicos`, `visita_eventos`, con RLS
provisional `using (true)` anotada para el paquete de seguridad). El default
de empresa en las tablas nuevas lo pone ese chat con el resultado de V11.
Siguen pendientes también `crear_orden_de_cotizacion` y **no crear
`registrar_pago_factura`**. Esa función se escribió en
`cierre-del-ciclo-para-el-chat.md` §1.3 cuando el saldo vivía en `facturas`.
Con la decisión del 8 de septiembre (el pago cuelga de la cotización), ese
trabajo lo hace `registrar_pago`. Si existieran las dos, habría dos caminos
para registrar dinero y tarde o temprano se usaría el equivocado (decidido
el 9 de septiembre).

**Hallazgos del arquitecto, sin verificar:** si "Allow new users to sign up"
está encendido en Supabase Auth, cualquiera con la publishable key se crea
una cuenta y, con `using (true)`, ve y edita todo (la consulta de `anon` del
10 de septiembre, que dio cero filas, no cubre este caso). Si alguna función
`bot_*` es `security definer`, la publishable key podría bastar para
llamarla desde internet, porque Postgres da `execute` a `public` por
defecto; falta confirmar con qué rol entra n8n antes de revocar, y revisar
si algún nodo usa la credencial "Supabase account" (probablemente service
role) para borrarla si no se usa.

**Para Claude Code, cuando existan las tablas y lleguen los resultados de
V1–V12:** pantalla Agenda para un usuario (calendario semanal, alta de
visita con o sin orden, técnicos, eventos, catálogo de técnicos). Después:
paquete de seguridad + Edge Function + pantalla Usuarios; luego la firma;
luego cobranza (`pagos`) y los `revoke` pendientes de `Facturas.jsx`. Este
orden invierte el que traía la lista desde el 8 de septiembre porque Marcos
decidió priorizar la agenda (ver "Decisiones tomadas").

**Para Marcos:** probar el tema claro con sesión iniciada, sobre todo
Conversaciones y el cajón de Cotizaciones, que tienen estilos propios y no
se verificaron.

**Sigue abierto, sin resolver hoy:** el cliente que aprobó su cotización el
8 de septiembre sigue sin fecha de instalación. Es la razón original de todo
el trabajo de agenda de hoy.

**14 de septiembre de 2026 — lo que agregó la sesión de la alerta.**

**Lo más urgente que hay hoy, por encima del objetivo en curso:** el token de
Meta va en texto plano en el header del nodo `HTTP Request1`, y ese workflow ya
se exportó a un JSON que salió de la máquina. Hay que rotarlo, crear la
credencial *Header Auth* en n8n y usarla en `HTTP Request1` y en `Alertar a
Marcos`. En el mismo export van la apikey de Evolution, la IP del VPS con su
puerto y una conversación real de un cliente, todo dentro del `pinData`.

**Bloqueado, esperando a Meta:** la alerta completa. No se ha ejecutado ni una
vez y no se puede probar hasta que la plantilla diga Activa; antes de eso Meta
responde `132001`.

**Limpieza pendiente en `zentec-bot-final`:** borrar los nodos muertos de
Evolution —`Webhook` (ruta `zentec-baileys`), su `Code in JavaScript` y el
`pinData` que cuelga de él— más `Get many rows`, que ya estaba huérfano.

**Para cuando toque la agenda:** confirmarle la fecha de instalación al cliente
también es un mensaje no solicitado y necesita su propia plantilla.
`appointment_confirmation_1` de la biblioteca de Meta es buen punto de partida.
Lo mismo aplica a los recordatorios de cobranza del diseño de pagos; conviene
pedirle a Meta esas plantillas juntas.

**10 de septiembre de 2026 — qué se cerró y qué se corrige de esta lista.**

**Cerrado:** la consulta de verificación de políticas para `anon` por fin se
corrió, desde la terminal de Marcos, y devolvió **cero filas**. Ninguna tabla
de `public` es legible sin sesión iniciada, así que la publishable key que va a
la vista en el build del panel no abre nada. Sale de la lista de abajo.

**Cerrado también:** el `bot_conversaciones.solicitud_id` que estaba en duda ya
está verificado contra `information_schema`. La tabla tiene `id`, `numero`,
`rol`, `mensaje`, `created_at`, `solicitud_id` y `empresa_id`.

**Corrección a esta misma lista:** la entrada "los seis commits del panel son
locales" quedó obsoleta dos veces. El 8 de septiembre se verificó que ya
estaban en `origin/main`, y hoy hay **un** commit local sin subir, `9433f54`.
Esa es la única deuda de push que existe.

**Sin verificar, de hoy:** Marcos confirmó en pantalla que Prospectos "ya sale
mejor", pero no se comprobó dato por dato que el badge **espera** salga
exactamente donde debe. Se comprueba abriendo Prospectos y cruzando una fila
contra su conversación: si el último mensaje del chat es del cliente, esa fila
debe traer el badge.

**Agregado, menor:** si el filtro resulta útil, falta un botón "Esperan
respuesta" junto a "Se enfrían". Ya está el dato calculado en cada fila; es
solo la vista.

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

**Push a remoto:** corregido el 10 de septiembre — los seis commits ya estaban
en `origin/main`. Lo que falta subir es `9433f54`, el arreglo de Prospectos.

**Verificación pendiente:** la fecha del 1 de octubre de 2026 en que Meta
dejaría de regalar mensajes de servicio, contra la tarjeta de tarifas oficial
de Meta para México.
