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
  /** Nome padrão sugerido antes da usuária editar o perfil. */
  userName: 'você',
  /** Emoji/assinatura usada ao lado das saudações. */
  greetingEmoji: '🌷',
} as const

/** Saudação com o nome cadastrado no Perfil (ver DataContext/profile). */
export const greeting = (name: string = brand.userName) => `Olá, ${name}! ${brand.greetingEmoji}`
