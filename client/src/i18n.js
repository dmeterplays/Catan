/**
 * Textos compartilhados em português do Brasil (pt-BR).
 * Os nomes internos (brick, lumber, wool...) continuam em inglês porque
 * o servidor usa esses nomes. Aqui só traduzimos o que aparece na tela.
 */
export const NOMES_RECURSOS = {
  brick: 'tijolo',
  lumber: 'madeira',
  wool: 'lã',
  grain: 'trigo',
  ore: 'minério',
  cloth: 'tecido',
  coin: 'moeda',
  paper: 'papel',
};

export const nomeRecurso = (r) => NOMES_RECURSOS[r] || r;

export const NOMES_TRILHAS = {
  science: 'ciência',
  politics: 'política',
  trade: 'comércio',
};

export const nomeTrilha = (t) => NOMES_TRILHAS[t] || t;
