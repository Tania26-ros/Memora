/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dirección del proyecto de Supabase (etapa 5). */
  readonly VITE_SUPABASE_URL?: string
  /** Clave pública (anon/publishable) de Supabase. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}
