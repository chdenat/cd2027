const siteOrigin = (process.env.SITE_URL || 'https://christinedeloupy.fr').replace(/\/$/, '')
const stagingAuth = process.env.CD2027_WP_AUTH === '1'
const privateView = stagingAuth && !['0', 'false', 'off', 'no'].includes(String(process.env.PRIVATE_VIEW || 'true').trim().toLowerCase())

module.exports = {
  name: 'Christine Deloupy',
  description:
    'Accompagnement holistique pour femmes matures en transition de vie. Retrouver joie, sens et liberté.',
  origin: siteOrigin,
  stagingAuth: privateView,
  privateView,
  logo: 'https://christinedeloupy.fr/wp-content/uploads/2023/12/Logo-CD2024.png',
  socialLinks: [
    { label: 'Facebook', href: 'https://www.facebook.com/christinedeloupy.fr/', icon: 'facebook' },
    { label: 'Instagram', href: 'https://www.instagram.com/espace.kocoon/', icon: 'instagram' },
    { label: 'YouTube', href: 'https://www.youtube.com/channel/UCga29UmA7ocb5hbIh54iueg', icon: 'youtube' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/christine-deloupy-41000886/', icon: 'linkedin' },
    { label: 'Pinterest', href: 'https://fr.pinterest.com/kocoon38/', icon: 'pinterest' },
  ],
  navigation: [
    {
      label: 'Les accompagnements',
      href: '/mes-accompagnements/',
      items: [
        { label: 'Mes accompagnements', href: '/mes-accompagnements/' },
        { label: 'Renaissance souveraine', href: '/renaissance-souveraine/' },
        { label: 'Lecture akashique', href: '/lecture-akashique/' },
        { label: 'La voie de la sagesse', href: '/accompagnement-abondance-et-joie/' },
      ],
    },
    {
      label: 'Les bijoux',
      href: '/mes-bijoux/',
      items: [
        { label: 'Mes bijoux', href: '/mes-bijoux/' },
        { label: 'Bracelet chemin de vie', href: '/mes-bijoux/bracelet-chemin-de-vie/' },
        { label: 'Bracelet Magik intention', href: '/mes-bijoux/bracelet-magik-intention/' },
      ],
    },
    { label: 'La boutique', href: '/boutique/' },
    {
      label: 'Le journal',
      href: '/mon-blog/',
      items: [
        { label: 'Derniers articles', href: '/mon-blog/' },
        { label: 'Développement personnel', href: '/categorie/developpement-personnel/' },
        { label: 'Spiritualité', href: '/categorie/spiritualite/' },
        { label: 'Rituels', href: '/categorie/rituel/' },
        { label: 'Mon podcast', href: '/mon-podcast/' },
      ],
    },
    { label: 'Contact', href: '/contact/' },
  ],
  footerLinks: [
    { label: 'Mentions légales', href: '/mentions-legales/' },
    { label: 'Conditions générales de vente', href: '/cgv/' },
    { label: 'Politique de confidentialité', href: '/politique-de-confidentialite/' },
  ],
}
