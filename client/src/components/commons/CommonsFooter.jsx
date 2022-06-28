import './Commons.css';

import {
    Icon,
    Image
} from 'semantic-ui-react';
import React from 'react';

const CommonsFooter = () => {
  const contactLinks = [
    {
      key: 'email',
      href: 'mailto:info@libretexts.org',
      text: 'Contact Us',
      title: 'Contact Us (opens new email)',
      icon: false,
    },
    {
      key: 'facebook',
      href: 'https://www.facebook.com/LibreTexts',
      text: '',
      title: 'LibreTexts on Facebook (opens in new tab)',
      icon: true,
      iconName: 'facebook f',
    },
    {
      key: 'twitter',
      href: 'https://twitter.com/libretexts',
      text: 'Contact Us',
      title: 'LibreTexts on Twitter (opens in new tab)',
      icon: true,
      iconName: 'twitter',
    },
    {
      key: 'legal',
      href: 'https://libretexts.org/legal/index.html',
      text: 'Legal',
      title: 'Legal (opens in new tab)',
      icon: false,
    },
    {
      key: 'a11y',
      href: '/accessibility',
      text: 'Accessibility',
      title: 'Accessibility (opens in new tab)',
      icon: false,
    },
  ];

  return (
    <div
      id="commons-footer"
      className={process.env.REACT_APP_ORG_ID === 'libretexts' ? 'libretexts-footer' : 'libregrid-footer'}
    >
      {(process.env.REACT_APP_ORG_ID === 'libretexts') ? (
        <>
          <div className="footer-row">
            <p>The LibreTexts libraries are supported by the United States Department of Education Open Textbook Pilot Project.</p>
          </div>
          <div className="footer-row footer-links">
            {(contactLinks.map((item) => (
              <a
                href={item.href}
                rel="noreferrer"
                target="_blank"
                title={item.title}
                className="contact-link"
                key={item.key}
              >
                {item.icon ? (
                  <Icon name={item.iconName} />
                ) : (
                  <span aria-hidden={true}>{item.text}</span>
                )}
              </a>
            )))}
          </div>
        </>
      ) : (
        <>
          <p id="commons-poweredby-tagline"><em>powered by</em></p>
          <Image
            src="/transparent_logo.png"
            size="small"
            className="cursor-pointer"
            centered
            onClick={() => {
              window.open('https://libretexts.org', '_blank', 'noopener');
            }}
            alt="LibreTexts"
          />
        </>
      )} 
    </div>
  )
}

export default CommonsFooter;
