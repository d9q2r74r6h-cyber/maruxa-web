export default function sitemap() {
  return [
    {
      url: 'https://panaderiamaruxa.cl',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://panaderiamaruxa.cl/contacto',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
