import {getRequestConfig} from 'next-intl/server';

import fr from '../traduction/fr.json';
import en from '../traduction/en.json';

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;

  if (locale !== 'fr' && locale !== 'en') {
    locale = 'fr';
  }

  return {
    locale,
    messages: locale === 'en' ? en : fr
  };
});
