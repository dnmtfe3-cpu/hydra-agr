const SITE = "https://www.hydraagro.sbs/";
const TITLE = "Hydra Agro | Gestão de Gado, Rebanho e Fazenda";
const DESCRIPTION = "Hydra Agro é um aplicativo para gestão de gado, controle de rebanho e rotina da fazenda, com identificação por NFC, equipe e operações rurais em Android, iPhone, iPad e web.";

function setMeta(selector: string, attr: string, value: string) {
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  if (!node) {
    node = document.createElement("meta");
    const match = selector.match(/meta\[(name|property)="([^"]+)"\]/);
    if (match) node.setAttribute(match[1], match[2]);
    document.head.appendChild(node);
  }
  node.setAttribute(attr, value);
}

function setLink(rel: string, href: string) {
  let node = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!node) {
    node = document.createElement("link");
    node.rel = rel;
    document.head.appendChild(node);
  }
  node.href = href;
}

if (typeof document !== "undefined") {
  document.title = TITLE;
  setMeta('meta[name="description"]', "content", DESCRIPTION);
  setMeta('meta[name="robots"]', "content", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
  setMeta('meta[property="og:title"]', "content", TITLE);
  setMeta('meta[property="og:description"]', "content", DESCRIPTION);
  setMeta('meta[property="og:url"]', "content", SITE);
  setMeta('meta[property="og:type"]', "content", "website");
  setMeta('meta[name="twitter:card"]', "content", "summary_large_image");
  setMeta('meta[name="twitter:title"]', "content", TITLE);
  setMeta('meta[name="twitter:description"]', "content", DESCRIPTION);
  setLink("canonical", SITE);

  const old = document.getElementById("hydra-seo-schema");
  old?.remove();
  const schema = document.createElement("script");
  schema.id = "hydra-seo-schema";
  schema.type = "application/ld+json";
  schema.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}#organization`,
        name: "Hydra Agro",
        url: SITE,
        logo: `${SITE}icon-512.png`
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}#website`,
        url: SITE,
        name: "Hydra Agro",
        inLanguage: "pt-BR",
        publisher: { "@id": `${SITE}#organization` }
      },
      {
        "@type": "SoftwareApplication",
        name: "Hydra Agro",
        url: SITE,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android, iOS, iPadOS",
        description: DESCRIPTION,
        featureList: [
          "Gestão de gado e rebanho",
          "Controle de fazenda e propriedade rural",
          "Identificação de animais por NFC",
          "Gestão de equipe e atividades rurais",
          "Acompanhamento de operações da propriedade"
        ],
        publisher: { "@id": `${SITE}#organization` }
      }
    ]
  });
  document.head.appendChild(schema);
}
