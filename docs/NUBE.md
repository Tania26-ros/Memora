# Activar la nube de Memora (Supabase)

Memora funciona sin nube. Para que la gente pueda entrar con su correo y guardar su copia en línea:

1. **Crear el proyecto** en [supabase.com](https://supabase.com) → *New project* (región São Paulo, `sa-east-1`, la más cercana a Perú). El plan gratis permite 2 proyectos activos por organización.
2. **Crear las tablas y reglas**: en *SQL Editor* pega y ejecuta `supabase/migrations/20261107000000_memora_cuentas.sql`. Crea los perfiles, la carpeta privada `backups` y las reglas para que cada persona solo vea lo suyo.
3. **Correo con código**: en *Authentication → Emails → Magic Link*, añade `{{ .Token }}` al mensaje para que llegue el código de 6 dígitos. En *URL Configuration* pon la dirección de la app (por ejemplo `https://memora-4b6e.vercel.app`) y `https://*-memora-4b6e.vercel.app/**` en *Redirect URLs*.
4. **Conectar la app**: en Vercel → *Settings → Environment Variables* añade
   - `VITE_SUPABASE_URL` = la *Project URL*
   - `VITE_SUPABASE_ANON_KEY` = la clave *anon* o *publishable* (es pública; la seguridad la dan las reglas del paso 2)

   y vuelve a desplegar.

Listo: en **Ajustes → Cuenta y copias** aparecerá «Entrar con tu correo».
