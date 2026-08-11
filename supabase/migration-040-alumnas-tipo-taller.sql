-- Migración 040 · `alumnas.tipo_inscripcion` acepta 'taller'
--
-- BUG DE PRODUCCIÓN (11 ago 2026): convertir un lead del Seminario Angelo en
-- inscrito no hacía nada. La hoja se cerraba, el lead seguía en la lista y no
-- aparecía ninguna inscrita.
--
-- Causa: el motor de la formación ahora corre también proyectos por sedes.
-- En esos, el "producto" son los encuentros elegidos y `PagoForm` manda
-- `tipo_inscripcion = 'taller'`. El CHECK sólo conocía los tres productos de
-- la formación, así que el INSERT fallaba… y el catch del frontend se comía
-- el error (arreglado aparte en forms-sheets.jsx: ahora avisa y no cierra).
--
-- Lección para la próxima: al reusar el motor de la formación para un
-- proyecto nuevo, revisar también los CHECK de `alumnas`, no sólo el
-- `proyecto_id` de las queries.

alter table public.alumnas drop constraint if exists alumnas_tipo_inscripcion_chk;

alter table public.alumnas
  add constraint alumnas_tipo_inscripcion_chk
  check (tipo_inscripcion = any (array['completa','dos_encuentros','un_encuentro','taller']));
