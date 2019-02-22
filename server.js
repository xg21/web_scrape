const express = require('express');
const app = express();
const bodyparser = require('body-parser')
const cheerio = require('cheerio');
const got = require('got');
const fs = require('fs');

app.use(express.static(__dirname + '/public'));
app.set('view engine','ejs');
app.use(bodyparser.urlencoded({extended: true}));

app.get('/api/',function(req, res)
{
	makeJSON(req.query.company, req.query.type, function (json)
	{
		res.end(JSON.stringify(json));
	})
})

function makeJSON(keyword, type, fn)
{
	const rules = {
		'price': 
		{
			'url': `https://www.nasdaq.com/symbol/${keyword}/real-time`
			, 'desc': 'Stock Price'
			, 'query': '#qwidget_lastsale'
		}
		, 'trend': 
		{
			'url': `https://www.nasdaq.com/symbol/${keyword}/real-time`
			, 'desc': 'Stock Trend'
			, 'query': '#qwidget_percent'
		}
		, 'news': {
			'url': `https://www.nasdaq.com/symbol/${keyword}/news-headlines`
			, 'desc': 'What News Articles'
			, 'query': '.news-headlines .fontS14px a'
		}
		, 'call': {
			'url': `https://www.nasdaq.com/symbol/${keyword}/call-transcripts`
			, 'desc': 'Transcripts'
			, 'query': '#quotes_content_left_CalltranscriptsId_CallTranscripts .fontS14px a'
			, 'process': function (els, fn)
			{
				let json = {};
				if (els.length > 0)
				{
					let suburl = els.eq(0).attr('href');
					retrieve({
						'url': 'https://www.nasdaq.com' + suburl
						, 'desc': 'Detail'
						, 'query': '#SAarticle p'
						, 'process': function (els)
						{
							let article = [];
							for (let i = 0; i < els.length; i++)
							{
								article.push(els.eq(i).html());
							}
							if (article.length > 4)
							{
								json['Call Transcript When'] = article[2];
							}

							fn(json);
						}
					}
					, fn);
				}
				else
				{
					fn(json);
				}
			}
		}
	};

	if (type && rules[type])
	{
		retrieve(rules[type], fn);
	}
}


function retrieve(rule, fn)
{
	request(rule['url'], function (error, html)
	{
		if (error == null)
		{
			const $= cheerio.load(html);

			let els = $(rule['query']);
			if (typeof(rule['process']) == 'function')
			{
				rule['process'](els, fn);
			}
			else
			{
				let json = {};
				if (els.length == 1)
				{
					json[rule['desc']] = els.html();
				}
				else if (els.length > 1)
				{
					json[rule['desc']] = [];
					for (let k = 0; k < els.length; k++)
					{
						json[rule['desc']].push(els.eq(k).html());
					}
				}
				fn(json);
			}
		}
		else
		{//~~make sure fn will be invoked anyway
			fn(error);
		}
	});
}

function request(url, fn)
{
	got(url).then(res => {fn(null, res.body)}).catch(err => {fn(err)})
}

app.listen(3000, function ()
{
	console.log('App run on port 3000!');
})