d3.select(window)
  .on("mousemove", mousemove)
  .on("mouseup", mouseup)
  .on("touchstart", mousedown)
  .on("touchstop", mouseup)
  .on("touchmove", mousemove);

var yearChart = dc.barChart('#year', 'charts');
var casualtyChart = dc.barChart('#casualties', 'charts');
var conflictList = dc.selectMenu('#conflict', 'charts');
var battleList = dc.selectMenu('#battle', 'charts');

var temp_id_filter = [];

var rotate = false,
  click_toggle = false,
  list_filtered = false,
  battle_selected = false;

var selectedIndex = 0,
  scale_adjust = 1.5,
  scale_offset = -100;

var width = 755,
  height = 655,
  x_offset = 0,
  y_offset = 0,
  active = d3.select(null);

var chart_width = 360,
  chart_height = 125,
  conflict_height = 500,
  conflict_width = battle_width = 370,
  battle_height = 240;

var max_viewable = 7;

var cas_value_range,
  year_value_range,
  year_num_bins = 15,
  cas_num_bins = 20;

var margins = {
    top: 10,
    right: 20,
    bottom: 40,
    left: 25
  },
  row_margins = {
    top: 10,
    right: 20,
    bottom: 35,
    left: 10
  };

var radius = height / 2 - 5,
  scale = radius,
  time = Date.now(),
  velocity = 0.008;

var battle_site;

var dateFormat = d3.time.format("%Y"),
  casualtyFormat = d3.format(",d");

var casualty_domain = [100, 1000, 10000, 100000, 1000000, 10000000];
var casualty_color_scale = ["yellow", "yellow", "orange", "orange", "red", "red"];

var casualty_scale = d3.scale.pow().exponent(0.5)
  .domain(casualty_domain)
  .range(casualty_color_scale);

var projection = d3.geo.orthographic()
  .translate([width / 2 +
    x_offset, height / 2
  ])
  .scale(scale)
  .clipAngle(90)
  .precision(.6);

var globe_svg = d3.select("#map-svg").append("svg")
  .attr("width", width)
  .attr("id", "globe-map")
  .attr("height", height)
  .on("mousedown", mousedown)
  .on("click", stopped, true);

globe_svg.append("rect")
  .attr("class", "background")
  .attr("width", width)
  .attr("height", height)
  .on("click", reset);

var g = globe_svg.append("g").attr('id', "g");

var ocean = g.append("svg:circle")
  .attr('cx', width / 2 + x_offset)
  .attr('cy', height / 2 + y_offset)
  .attr('r', radius)
  .attr('class', 'ocean'),
  grat = g.append("g").attr("class", "graticule"),
  land = g.append("g").attr("class", "land").attr("id", "countries"),
  battles = g.append("g").attr("class", "points");

var path = d3.geo.path()
  .projection(projection);

var graticule = d3.geo.graticule();

var zoom = d3.behavior.zoom()
  .translate([0, 0])
  .scale(1)
  .scaleExtent([1, 8])
  .on("zoom", zoomed);

/* Initialize tooltip */
var zoom_tip = d3.tip()
  .attr('class', 'd3-tip1')
  .attr('id', 'zoom-tip')
  .html(function (d) {
    var display_start_date = d.start_full_year;
    var display_end_date = d.end_full_year;

    return ("<strong>Battle: </strong> <a target='_blank' href=" + d.url + "><span style='color:light blue'>" + d.name + "</span></a>" +
      "<br>" + "<strong>Casualties: </strong> <span style='color:orange'>" + casualtyFormat(d.casualties) + "</span>" +
      "<br>" + "<strong>Conflict: <a target='_blank' href=" + d.conflict_url + "></strong> <span style='color:light blue'>" + d.conflict + "</span></a>" +
      "<br>" + "<strong>Start Year: </strong> <span style='color:orange'>" + display_start_date + "</span>" +
      "<br>" + "<strong>End Year: </strong> <span style='color:orange'>" + display_end_date + "</span>");
  });

/* Initialize tooltip */
var tip = d3.tip()
  .attr('class', 'd3-tip2')
  .offset([-10, 0])
  .html(function (d) {
    return "<strong>Battle: </strong> <span style='color:orange'>" + d.name + "</span>" +
      "<br>" + "<strong>Casualties: </strong> <span style='color:orange'>" + casualtyFormat(d.casualties) + "</span>";
  });

globe_svg
  .call(zoom_tip)
  .call(tip);

var fragment = document.createDocumentFragment();
fragment.appendChild(document.getElementById('zoom-tip'));
document.getElementById('map-svg').appendChild(fragment);

globe_svg
  .call(zoom.event);

queue()
  .defer(d3.json, "data/world-110m.json")
  .defer(d3.csv, "data/casualties_data.csv")
  .await(ready);

function ready(error, world, battle_data) {
  if (error) throw error;

  var battles_array = [];
  var id_count = 0;
  battle_data.forEach(function (d) {
    id_count++;
    d.id = id_count;
    d.name = d["Name"];
    d.conflict = d["Conflict"];
    d.casualties = +d["Casualties"];

    for (i = 0; i < casualty_domain.length; i++) {
      for (j = 1; j < 10; j++) {
        if (d.casualties >= j * casualty_domain[i] && d.casualties < (j + 1) * casualty_domain[i]) {
          d.casualty_bin = j * casualty_domain[i];
        }
      }
    }

    if (d["Start Year"].search("BC") > -1) {
      var temp_date = d["Start Year"].split(" ")[0];
      var new_date_constant = 6 - temp_date.length;
      var new_date_zeroes = "-";
      for (var i = 0; i < new_date_constant; i++) {
        new_date_zeroes += "0";
      }
      var new_date = new_date_zeroes + temp_date;
      d.start_year = new Date(new_date);
    } else if (d["Start Year"].length < 4) {
      var temp_date = d["Start Year"];
      var new_date_constant = 4 - temp_date.length;
      var new_date_zeroes = "";
      for (var i = 0; i < new_date_constant; i++) {
        new_date_zeroes += "0";
      }
      var new_date = new_date_zeroes + temp_date;
      d.start_year = new Date(new_date);
    } else {
      d.start_year = new Date(d["Start Year"]);
    }

    d.start_full_year = d.start_year.getFullYear() + 1;

    if (d["End Year"].search("BC") > -1) {
      var temp_date = d["End Year"].split(" ")[0];
      var new_date_constant = 6 - temp_date.length;
      var new_date_zeroes = "-";
      for (var i = 0; i < new_date_constant; i++) {
        new_date_zeroes += "0";
      }
      var new_date = new_date_zeroes + temp_date;
      d.end_year = new Date(new_date);
    } else if (d["End Year"].length < 4) {
      var temp_date = d["End Year"];
      var new_date_constant = 4 - temp_date.length;
      var new_date_zeroes = "";
      for (var i = 0; i < new_date_constant; i++) {
        new_date_zeroes += "0";
      }
      var new_date = new_date_zeroes + temp_date;
      d.end_year = new Date(new_date);
    } else {
      d.end_year = new Date(d["End Year"]);
    }

    d.end_full_year = d.end_year.getFullYear() + 1;

    d.type = d["Type"];
    d.coords = d["Coordinates"].replace(/�/g, "");
    if (d.coords != null) {
      var strSplit = d.coords.split(",");
      d.lat = +strSplit[0];
      d.long = +strSplit[1];
    } else {
      d.long = +"0.0";
      d.lat = +"0.0";
    }
    d.url = d["URL"];
    d.conflict_url = d["Conflict_URL"];
    battles_array.push(d);
  });

  grat.append("path")
    .datum(graticule)
    .attr("d", path);

  land.selectAll("path")
    .data(topojson.feature(world, world.objects.countries).features)
    .enter()
    .append("path")
    .attr("d", path);

  var cross_data = crossfilter(battle_data);

  var battle_dim = cross_data.dimension(function (d) {
    return d.id;
  });

  var battle_site = battles.selectAll(".points")
    .data(battles_array);

  battle_site.enter()
    .append("path");

  battle_site.call(tip);

  battle_site
    .datum(function (d) {
      return {
        type: "Point",
        coordinates: [d.long, d.lat],
        casualties: d.casualties,
        conflict: d.conflict,
        id: d.id,
        name: d.name,
        start_year: d.start_year,
        start_full_year: d.start_full_year,
        end_year: d.end_year,
        end_full_year: d.end_full_year,
        battle_type: d.type,
        url: d.url,
        conflict_url: d.conflict_url
      };
    })
    .attr("class", "points")
    .attr("d", path.pointRadius(2.5))
    .attr("id", function (d) {
      return "id" + d.id;
    })
    .attr("fill", function (d) {
      return casualty_scale(d.casualties);
    })
    .attr("fill-opacity", 1)
    .attr("stroke", "black")
    .attr("stroke-width", 1)
    .on("mouseover", function (d) {
      tip.show(d);
    })
    .on("mouseout", function (d) {
      tip.hide(d);
    })
    .on("click", clicked);

  //start date range construction
  var dateStartRange = d3.extent(battle, function (d) {
    return d.start_year;
  });

  //finish date range construction
  var dateFinishRange = d3.extent(battle, function (d) {
    return d.end_year;
  });

  year_value_range = (+dateFinishRange[1]) - (+dateStartRange[0]);

  var cas_range = d3.extent(battle, function (d) {
    return d.casualties;
  });

  cas_value_range = (cas_range[1]) - 0;

  var year_dim = cross_data.dimension(function (d) {
    return d.start_year;
  });

  var casualty_bin_dim = cross_data.dimension(function (d) {
    return d.casualty_bin;
  });

  var id_dim = cross_data.dimension(function (d) {
    return d.id;
  });

  var name_dim = cross_data.dimension(function (d) {
    return d.name;
  });

  var conflict_dim = cross_data.dimension(function (d) {
    return d.conflict;
  });

  var year_group = year_dim.group();

  var casualty_bin_group = casualty_bin_dim.group();

  var conflict_casualty_group = conflict_dim.group().reduceSum(function (d) {
    return d.casualties;
  });

  var name_casualty_group = name_dim.group().reduceSum(function (d) {
    return d.casualties;
  });

  var id_group = id_dim.group();

  //CREATE CONFLICT LIST
  conflictList.width(conflict_width)
    .height(conflict_height)
    .dimension(conflict_dim)
    .group(conflict_casualty_group)
    .multiple(true)
    .controlsUseVisibility(true)
    .on("filtered.monitor", function (chart, filter) {
      if (filter != null) {
        reset();
      }
    });

  //CREATE BATTLE LIST
  battleList.width(battle_width)
    .height(battle_height)
    .dimension(name_dim)
    .group(name_casualty_group)
    .multiple(false)
    .promptText("All Battles.")
    .controlsUseVisibility(true)
    .on("filtered.monitor", function (chart, filter) {
      battle_selected = true;

      if (filter != null) {

        //cheesy way to initiate rotate and zoom
        var item = battles_array.find(function (d) {
          return d.name == filter;
        }).id;
        var data_to_locate = d3.select(battle_site[0][item - 1]);
        var evt = new MouseEvent("click");

        data_to_locate[0][0].dispatchEvent(evt);

      } else {
        battle_selected = false;
        reset();
      }
    });

  //CREATE YEAR CHART
  yearChart.width(chart_width)
    .height(chart_height)
    .margins(margins)
    .dimension(year_dim)
    .group(year_group)
    .gap(5)
    .x(d3.time.scale().domain([new Date("-001200"), new Date("002200")]))
    .elasticY(true)
    .controlsUseVisibility(true)
    .on("postRedraw", function (chart) {
      chart.selectAll("g.x text")
        .attr('transform', 'translate(-10, 10) rotate(315)');
    })
    .on("postRender", function (chart) {
      chart.selectAll("g.x text")
        .attr('transform', 'translate(-10, 10) rotate(315)');
    })
    .on("filtered.monitor", function (chart, filter) {
      if (click_toggle == true) {
        reset()
      }
    })
    .xAxisPadding(10)
    .xAxis()
    .tickFormat(
      d3.time.format('%Y')
    )
    .ticks(10);

  yearChart.yAxis().ticks(3, ",.0f")
    .tickSize(5, 0)

  //CREATE CASUALTY BAR CHART
  casualtyChart.width(chart_width)
    .height(chart_height)
    .margins(margins)
    .dimension(casualty_bin_dim)
    .group(casualty_bin_group)
    .gap(2)
    .x(
      d3.scale.log()
      .clamp(true).domain([100, 10000001])
    )
    .elasticY(true)
    .controlsUseVisibility(true)
    .on("postRedraw", function (chart) {
      chart.selectAll("g.x text")
        .attr('transform', 'translate(-10, 10) rotate(315)');
    })
    .on("postRender", function (chart) {
      chart.selectAll("g.x text")
        .attr('transform', 'translate(-10, 10) rotate(315)');
    })
    .on("filtered.monitor", function (chart, filter) {
      if (click_toggle == true) {
        reset()
      }
    })
    .xAxis()
    .ticks(2, ",.0f")
    .tickSize(5, 0);

  casualtyChart.yAxis().ticks(3, ",.0f")
    .tickSize(5, 0);

  var lastFilterArray = [];
  battles_array.forEach(function (d, i) {
    lastFilterArray[i] = 1;
  });

  for (var i = 0; i < dc.chartRegistry.list('charts').length; i++) {
    var chartI = dc.chartRegistry.list('charts')[i];
    chartI.on("filtered", RefreshMap);
  }

  function RefreshMap() {
    dc.events.trigger(function (d) {
      var filterArray = id_group.all();
      filterArray.forEach(function (d, i) {
        if (d.value != lastFilterArray[i]) {
          lastFilterArray[i] = d.value;
          if (d.value == 1) {
            if (battle_selected == false) {
              d3.select("#id" + d.key)
                .attr("display", "block")
                .transition().duration(500)
                .attr("d", path.pointRadius(7))
                .transition().delay(550).duration(500)
                .attr("d", path.pointRadius(2.5));
            } else {
              d3.select("#id" + d.key)
                .attr("display", "block")
                .attr("d", path.pointRadius(2.5));
            }

          } else {
            d3.select("#id" + d.key)
              .attr("display", "none");
          }
        } else {
          if (d.value == 1) {
            if (battle_selected == false) {
              d3.select("#id" + d.key)
                .attr("display", "block")
                .transition().duration(500)
                .attr("d", path.pointRadius(7))
                .transition().delay(550).duration(500)
                .attr("d", path.pointRadius(2.5));
            } else {
              d3.select("#id" + d.key)
                .attr("display", "block")
                .attr("d", path.pointRadius(2.5));
            }

          } else {
            d3.select("#id" + d.key)
              .attr("display", "none");
          }
        }
      })
    })
  };

  RefreshMap();

  dc.renderAll('charts');

};

var m0, o0;

function mousedown() {
  m0 = [d3.event.pageX, d3.event.pageY];
  o0 = projection.rotate();
  d3.event.preventDefault();
};

function mousemove() {
  if ((m0) && (click_toggle == false)) {
    var m1 = [d3.event.pageX, d3.event.pageY],
      o1 = [o0[0] + (m1[0] - m0[0]) / 6, o0[1] + (m0[1] - m1[1]) / 6];
    o1[1] = o1[1] > 90 ? 90 :
      o1[1] < -90 ? -90 :
      o1[1];
    projection.rotate(o1);
    refresh();
  }
};

function mouseup() {
  if (m0) {
    mousemove();
    m0 = null;
  }
};

function refresh() {
  globe_svg.selectAll("path").attr("d", path.projection(projection));
};

function clicked(d) {

  if (click_toggle) {
    if (active.node() === this) {
      d3.select(this).transition().duration(300)
        .attr("d", path.pointRadius(2.5))
      return reset();
    } else {
      d3.select(this).transition().duration(300)
        .attr("d", path.pointRadius(2.5))

      zoom_tip.hide();

    }
  }

  active = d3.select(this).classed("active", true);

  tip.hide(d);

  click_toggle = true;

  //Global Rotation to clicked point
  (function transition() {
    d3.transition()
      .duration(700)
      .tween("rotate", function () {
        var r = d3.interpolate(projection.rotate(), [-d.coordinates[0], -d.coordinates[1]]);
        return function (t) {
          projection.rotate(r(t));
          globe_svg.selectAll("path").attr("d", path.projection(projection));
        };
      })
      .each('end', function (j) {

        //Increase focused point radius
        active.transition().duration(100)
          .attr("d", path.pointRadius(5));

        //determine the bounds for the focused point for zoom
        var bounds = path.bounds(d),
          dx = bounds[1][0] - bounds[0][0],
          dy = bounds[1][1] - bounds[0][1],
          x = (bounds[0][0] + bounds[1][0]) / 2,
          y = (bounds[0][1] + bounds[1][1]) / 2,
          scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height))),
          translate = [width / 2 - scale * x, height / 2 - scale * y];

        //transition to zoom
        g
          .datum(d)
          .transition()
          .duration(750)
          .style("stroke-width", 1.5 / scale + "px")
          .attr("transform", "translate(" + translate + ")scale(" + scale + ")")
          .each('end', function (i) {

            //Display the zoom tooltip
            zoom_tip.show(i, this)
              .attr("position", "absolute")
              .style("top", "42px")
              .style("left", "0px");
          });
      });
  })();

};

function reset() {
  active.classed("active", false);
  active = d3.select(null);

  tip.hide();

  zoom_tip.hide();

  click_toggle = false;

  g.transition()
    .duration(750)
    .style("stroke-width", "1.5px")
    .attr("transform", "");
}

function zoomed() {
  g.style("stroke-width", 1.5 / d3.event.scale + "px");
  g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");

}

function stopped() {
  if (d3.event.defaultPrevented) d3.event.stopPropagation();
}

d3.select(self.frameElement).style("height", height + "px");