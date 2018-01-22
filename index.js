'use strict';

const Metalsmith         = require('metalsmith');
const lunr               = require('metalsmith-lunr');
const prism              = require('metalsmith-prism');
const drafts             = require('metalsmith-drafts');
const assets             = require('metalsmith-assets');
const inspect            = require('metalsmith-inspect');
const layouts            = require('metalsmith-layouts');
const inPlace            = require('metalsmith-in-place');
const paginate           = require('metalsmith-paginate');
const gravatar           = require('metalsmith-gravatar');
const excerpts           = require('metalsmith-excerpts');
const redirect           = require('metalsmith-redirect');
const permalinks         = require('metalsmith-permalinks');
const collections        = require('metalsmith-collections');
const discoverHelpers    = require('metalsmith-discover-helpers');
const discoverPartials   = require('metalsmith-discover-partials');
const markdownRemarkable = require('metalsmith-markdown-remarkable');
const feed               = require('metalsmith-feed');

const remarkableEmoji    = require('remarkable-emoji');
const remarkableMentions = require('remarkable-mentions');

const striptags          = require('striptags');

const {TfIdf}            = require('natural');

function relations(options) {
  options = Object.assign({
    terms: 5,
    max: 5,
    threshold: 0,
    text: document => String(document.contents)
  }, options);

  if(options.match == null) {
    throw new Error("Expected match criteria on which to filter.");
  }

  function matchDocument(file) {
    const {match} = options;

    return Object.keys(match).every(key => {
      if(file[key] === match[key]) { return true }
      if(file[key] && file[key].indexOf) {
        return file[key].indexOf(match[key]) > -1;
      }

      return false;
    });
  }

  return (files, metalsmith, done) => {
    const tfidf = new TfIdf();
    const keys = Object.keys(files).filter(key => matchDocument(files[key]));

    keys.forEach(key => tfidf.addDocument(options.text(files[key]), key));

    keys.forEach((key, index) => {
      const document = files[key];
      const keyTerms = tfidf.listTerms(index)
      .slice(0, options.terms)
      .map(({term}) => term);

      document.relations = keys.reduce((relations, key, d) => {
        if(d !== index) {
          const frequency = tfidf.tfidf(keyTerms, d);

          if(frequency > options.threshold) {
            relations.push({key, frequency});
          }
        }

        return relations;
      }, [])
      .sort((a, b) => a.frequency - b.frequency)
      .slice(0, options.max)
      .map(({key}) => files[key]);
    });

    done();
  };
}

console.log('ENV:', process.env.NODE_ENV || 'development');

Metalsmith(__dirname)
.metadata({
  site: {
    // Site Info
    title: "Martin Ullrich",
    description: "Martin's dev blog",
    url: process.env.NODE_ENV === 'production' ? "https://dasmulli.blog" : 'http://localhost:8080',

    reading_time: true,
    words_per_minute: 200,

    disqus: '',
    google_analytics: 'UA-112754157-1',

    // Site Locale Info
    timezone: 'Europe/Vienna',
    locale: 'en_US',

    // Site Menu
    menu: [{
      title: 'About',
      url: '/about',
    }, {
      title: 'Archive',
      url: '/posts',
    }, {
      title: 'Home',
      url: '/',
    }],

    // Generator Info
    generator: {
      name: 'Matalsmith',
      url: "http://www.metalsmith.io/",
    },

    // Theme Info
    theme: {
      name: 'Neo-HPSTR Metalsmith Theme',
      url: "https://github.com/tjpeden/neo-hpstr-metalsmith-theme",
    },

    // Owner Info
    owner: {
      name: "Martin A. Ullrich",
      url: "https://dasmulli.github.io",
      bio: "Software Developer in the .NET space. Also do Java, Swift/ObjC and front-end stuff.",
      email: "martin.andreas.ullrich@gmail.com",
      twitter: 'dasmulli',
      networks: [{
        name: 'GitHub',
        icon: 'github-alt',
        url: "https://github.com/dasmulli",
      }, {
        name: 'Facebook',
        icon: 'facebook-official',
        url: "https://www.facebook.com/martin.andreas.ullrich",
      }, {
        name: 'StackOverflow',
        icon: 'stack-overflow',
        url: "https://stackoverflow.com/users/784387/martin-ullrich",
      }, {
        name: 'Twitter',
        icon: 'twitter',
        url: "https://twitter.com/dasmulli",
      }],
    },
  },
})
.use(inspect({
  disable: true,
  includeMetalsmith: true,
  exclude: ['contents',  'excerpt', 'stats', 'next', 'previous'],
}))
.source('./content')
.destination('./public')
.clean(true)
.use(drafts())
.use(collections({
  posts: {
    sortBy: 'date',
    reverse: true,
  }
}))
.use(relations({
  max: 3,
  match: {
    collection: 'posts',
  }
}))
.use(
  markdownRemarkable('full', {
    html: true,
    linkify: true,
    typographer: true,
  })
  .use(remarkableEmoji)
  .use(remarkableMentions())
)
.use(prism({
  lineNumbers: true,
}))
.use(excerpts())
.use(gravatar({
  owner: "martin.andreas.ullrich@gmail.com",
}))
.use(permalinks({
  pattern: ':title',
  linksets: [
    {
      match: { collection: 'posts' },
      pattern: ':date/:title',
    },
  ],
}))
.use(paginate({
  path: 'page',
}))
.use(discoverHelpers())
.use(discoverPartials())
.use(inPlace())
.use(layouts({
  engine: 'handlebars',
  default: 'page.html',
}))
.use(lunr({
  ref: 'path',
  indexPath: 'search/index.json',
  fields: {
    title: 5,
    contents: 1,
    tags: 10,
  },
  preprocess: striptags
}))
// .use(redirect({
//   '/old/path': '/new/path',
// }))
.use(assets({
  source: './assets',
}))
.use(feed({
  collection: 'posts',
  postDescription: (post) => post.description
}))
.build((error, files) => {
  if(error) {
    throw error;
  }
});
