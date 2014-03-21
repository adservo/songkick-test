'use strict';
/* jslint node: true */

var async = require('async');
var cheerio = require('cheerio');
var fs = require('fs');
var request = require('superagent');

var lists = {
  start: 1
};

var current = lists.start;

// Optionally be kind to their servers
var maxConcurrent = 2;
var listThrottle = 5; // Allow 5 seconds between processing of list pages

// Load and parse the detail page
function processDetailPage(url, cb) {
  var id = url.split('/').pop();
  console.log('Loading detail page : ', id);
  request
    .get(url)
    .end(function(err, res) {
      if(err) return console.error();
      if(res.status === 200) {
        console.log('Processing detail page : ', id);
        // Cache the detail page to disk
        fs.writeFileSync(process.cwd() + '/data/wegottickets.com/show/' + id + '.html', res.text);

        // Get the details from the page
        var $ = cheerio.load(res.text);
        var info = {
          artist: $('h1').first().text(),
          city: $('.venuetown').text(),
          venue: $('.venuename').text(),
          date: $('.VenueDetails h2').text().split(' ').slice(0, 4).join(' '),
          price: $('.eventPrice strong').first().text()
        }

        // Save the json to disk
        fs.writeFileSync(process.cwd() + '/data/wegottickets.com/json/' + id + '.json', JSON.stringify(info));
        cb();
      }
    });
};

function processDetailUrls(urls, cb) {
  async.eachLimit(urls, maxConcurrent, processDetailPage, cb);
};

function noteLastListPage($) {
  lists.end = parseInt($('.pagination_link').last().text());
  console.log('Last list page is : ' + lists.end);
};

function processListPage(html, cb) {
  console.log('Processing list page : ', current);
  var $ = cheerio.load(html);

  // Make a note of the last page if we don't already have it
  if(!lists.end) noteLastListPage($);

  // Keep a copy on disk - handy if errors occur to avoid making remote requests over and over
  fs.writeFileSync(process.cwd() + '/data/wegottickets.com/list/' + current + '.html', html);

  var detailUrls = $('.ListingAct h3 a').map(function() { return $(this).attr('href'); });
  processDetailUrls(detailUrls, function() { cb(); });
};

function loadNextListPage() {
  var url = 'http://www.wegottickets.com/searchresults/page/' + current + '/all';
  request
    .get(url)
    .end(function(err, res) {
      if(err) return console.error();
      if(res.status === 200) {
        // Process the list page and then call back when done
        processListPage(res.text, function() {
          current += 1;
          console.log('Current now ', current);
          if(current <= lists.end) {
            console.log('Loading next list page');
            setTimeout(loadNextListPage, listThrottle * 1000);
          }
        });
      }
    });
};

loadNextListPage();
