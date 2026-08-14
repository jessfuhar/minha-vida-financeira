/**
 * Configuração central de marca.
 *
 * O nome do sistema ainda não foi definido — troque os valores abaixo
 * quando o nome definitivo for escolhido. Nenhum outro arquivo deveria
 * precisar de alteração para isso: componentes e páginas sempre importam
 * esses valores em vez de escrever o nome "na mão".
 */
export const brand = {
  /** Nome provisório do sistema. */
  appName: 'Minha vida financeira',
  /** Versão curta usada em espaços pequenos (aba do navegador, ícones). */
  appShortName: 'MVF',
  /** Frase de identidade usada na barra lateral / telas de boas-vindas. */
  tagline: 'Vamos cuidar da sua vida financeira?',
  /** Nome da usuária (dado fictício, fase 1). */
  userName: 'Jéssica',
  /** Emoji/assinatura usada ao lado das saudações. */
  greetingEmoji: '🌷',
} as const

export const greeting = () => `Olá, ${brand.userName}! ${brand.greetingEmoji}`
