'use strict';

var config = require('../../config.json');
var $ = require('jquery');
var _ = require('lodash');
var Promise = require('bluebird');
var utils = require('./services/utils');
var url = require('url');
var api = require('./services/api');
var countryList = require('./widgets/country-list');
var countryDropdown = require('./widgets/country-dropdown');
var map = require('./widgets/map');
var topBeneficiaries = require('./widgets/top-beneficiaries');
var visualizations = require('./widgets/visualizations');
var treemap = require('./widgets/treemap');

// This function contains some hard-code.
function getRouteInfo() {
  var result = {
    isIndexPage: false,
    isCountryPage: false,
    isCountryDetailsPage: false,
    countryCode: null
  };

  var parts = url.parse(window.location.href, true);
  if (_.isObject(parts)) {
    result.isIndexPage = (parts.pathname == '/index.html') ||
      (parts.pathname == '/') || (parts.pathname == '');
    result.isCountryPage = parts.pathname == '/country.html';
    result.isCountryDetailsPage = parts.pathname == '/country-details.html';

    if (_.isObject(parts.query)) {
      result.countryCode = parts.query.country || null;
    }
  }

  return result;
}

function getCountriesWithData(countries) {
  var result = {};
  _.each(countries, function(country, code) {
    if (country.isDataAvailable) {
      result[code] = country;
    }
  });
  return result;
}

function getEmbedItems(countryCode) {
  var result = _.isObject(config.embed) ? _.values(config.embed) : [];

  if (config.countryCodeDimension) {
    var key = 'filters[' + config.countryCodeDimension + '][]';
    result = _.map(result, function(value) {
      var parts = url.parse(value, true);
      if (_.isObject(parts) && _.isObject(parts.query)) {
        if (!_.isUndefined(parts.query[key])) {
          parts.path = undefined;
          parts.search = undefined;
          parts.query[key] = countryCode;
          value = url.format(parts);
        }
      }
      return value;
    });
  }

  return result;
}

function getCountryPageUrl(countryCode) {
  if (
    (countryCode === undefined) ||
    (countryCode === null) ||
    (countryCode === '')
  ) {
    return '/';
  }
  return '/country.html?country=' + encodeURIComponent(countryCode);
}

function navigateToCountryPage(countryCode) {
  window.location.href = getCountryPageUrl(countryCode);
}

function bootstrap() {
  var route = getRouteInfo();
  if (route.isCountryPage || route.isCountryDetailsPage) {
    if (!route.countryCode) {
      window.location.href = 'index.html';
      return;
    }
  }

  var formatValue = utils.formatValue(config.valueFormattingScale);

  var promises = {
    countries: api.getCountries(),
    map: api.getGeoData()
  };

  promises.countries.then(function(countries) {
    countryDropdown.render($('#country-dropdown'), {
      countryCode: route.countryCode,
      countries: getCountriesWithData(countries),
      onSelectItem: navigateToCountryPage
    });
    countryList.render($('#country-list').empty(), {
      countryCode: route.countryCode,
      countries: getCountriesWithData(countries),
      getItemUrl: getCountryPageUrl
    });
    treemap.render($('#visualization-by-countries'), {
      endpoint: config.endpoint,
      dataset: config.dataset,
      state: config.visualizations.byCountries,
      formatValue: formatValue,
      onSelectItem: navigateToCountryPage,
      names: _.chain(countries)
        .map(function(item) {
          return [item.code, item.name];
        })
        .fromPairs()
        .value()
    });
    return countries;
  });

  Promise.all([promises.map, promises.countries]).then(function(results) {
    map.render($('#map-container').empty(), {
      data: results[0],
      countryCode: route.countryCode,
      countries: getCountriesWithData(results[1]),
      width: $(window).width(),
      height: $(window).height(),
      getItemUrl: getCountryPageUrl
    });
    return results;
  });

  var countryCode = route.countryCode;
  if (countryCode) {
    visualizations.render($('#embed-container'), {
      items: getEmbedItems(countryCode)
    });

    $('#country-details-link').attr('href',
      'country-details.html?country=' + encodeURIComponent(countryCode));

    promises.totalSubsidies = api.getTotalSubsidies({
      countryCode: countryCode
    });
    promises.topBeneficiaries = api.getTopBeneficiaries({
      countryCode: countryCode
    });

    promises.countries.then(function(countries) {
      $('#country-name').text(countries[countryCode].name);
      return countries;
    });

    promises.topBeneficiaries.then(function(items) {
      topBeneficiaries.render($('#top-beneficiaries').empty(), {
        items: items,
        formatValue: formatValue
      });
      return items;
    });

    promises.totalSubsidies.then(function(value) {
      $('#total-subsidies').text(formatValue(value));
      return value;
    });
  }
}

module.exports.bootstrap = bootstrap;
