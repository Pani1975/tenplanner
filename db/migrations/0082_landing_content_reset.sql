-- La landing ahora lee sus textos de esta tabla. Las filas anteriores eran la
-- semilla antigua (textos que ya no coinciden con la web) y, si se mantuvieran,
-- sustituirían los valores por defecto de lib/landing-content.ts.
DELETE FROM landing_content;
