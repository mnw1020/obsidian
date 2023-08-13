---<%* 
// v1.3: Fix error if imdbRating is undefined

// Get page source
let url = await tp.system.clipboard()
url = url.replace(/\?.*$/g,"") // remove unnecessary part after '?'
let page = await tp.obsidian.request({url})
let p = new DOMParser()
let doc = p.parseFromString(page, "text/html")
// Aliases for querySelector
let $ = s => doc.querySelector(s)
let $$ = s => doc.querySelectorAll(s)
// Get JSON with metadata
var json = JSON.parse(doc.querySelector("script[type='application/ld+json']").innerHTML)

let title = ""
if (json.alternateName != null) {
  title  = json.alternateName.replace(/&apos;/g, "'")
} else {
  title = json.name.replace(/&apos;/g, "'")
}
let image = ""
if(json.image != null) {
  image = json.image
}
let datePublished = ""
if (json.datePublished != null) {
  datePublished = JSON.stringify(json.datePublished).substring(1,5)
}
let keywords = ""
if (json.keywords != null) {
  keywords = JSON.stringify(json.keywords).toLowerCase().replace(/,/g, '", "')
}
let directors = ""
if (json.director != null) {
  directors = json.director.map((director) => director.name)
  directors = JSON.stringify(directors).replace(/null,?/g, "").replace(/,/g, ", ")
} 
let creators = ""
if (json.creator != null) {
  creators = json.creator.map((creator) => creator.name)
  creators = JSON.stringify(creators).replace(/null,?/g, "").replace(/,/g, ", ")
}
let duration = ""
if (json.duration != null) {
  duration = JSON.stringify(json.duration).toLowerCase()
  duration = duration.substring(3, 5) + " " + duration.substring(5, 8)
}
let description = $("span[data-testid='plot-xl']").innerText
let type = JSON.stringify(json['@type']).replace(/TV/, "").replace(/"/g, "").toLowerCase()
// G/PG/PG-13/R/NC-17 etc.
let contentRating = json?.contentRating || ""
let genres = JSON.stringify(json.genre).toLowerCase().replace(/,/g, ", ")
let stars = JSON.stringify(json.actor.map((actor) => actor.name)).replace(/,/g, ", ") 
let imdbRating = json.aggregateRating?.ratingValue || ""
let countries = $$("a[href*='country_of_origin']")
countries = Array.from(countries, countries => countries.textContent).join('", "')
%>
title: "<% title %>"
cover: "<% image %>"
description: "<% description %>"
released: <% datePublished %>
genres: <% genres %>
keywords: [<% keywords %>]
stars: <% stars %>
<%* type == "movie" ? tR += "directors: " + directors : tR += "creators: " + creators %>
type: <% type %>
contentRating: <% contentRating %>
imdbRating: <% imdbRating %>
url: "<% url %>"
countries: ["<% countries %>"]
---