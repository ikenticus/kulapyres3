var today = new Date();
var datedir = today.toJSON().slice(0,10) + '/';
var prefix = $('.kulapyres3-report').data('prefix');
var handle = $('.kulapyres3-report').data('handle');

// Overrides
var qs = new URLSearchParams(window.location.search);
if (qs.get('date') !== null) datedir = qs.get('date') + '/';
if (qs.get('handle') !== null) handle = qs.get('handle');

// Choices
$('.kulapyres3-report .kulapyres3-choice').each(function() {
    let choice = $(this);
    let csvfile = prefix + choice.data('csv');
    d3.csv(csvfile).then(function(data) {
        choice.append('<button class="choice-button">' + handle +
            '</button><div class="choice-dropdown"></div>');
        let drop = choice.find('div.choice-dropdown');
        data.forEach(d => {
            let flag = (d.handle == handle) ? 'active' : 'inactive';
            drop.append('<div class="' + flag + ' choice-handle">' + d.handle + '</div>');
        });
        // this only SETS position based on window scroll during render
        drop.css({left: choice.find('.choice-button').position().left});
    });
});
$('.kulapyres3-report .kulapyres3-choice').hover(function() {
    let choice = $(this);
    let drop = choice.find('div.choice-dropdown');
    // dynamically RESET position based on window scroll during hover
    drop.css({left: choice.find('.choice-button').position().left});
    drop.find('div').click(function() {
        let pick = $(this).text();
        qs.set('handle', pick);
        window.location = window.location.pathname + '?' + qs.toString();
    });
});

// Datepicker
$('.kulapyres3-report .kulapyres3-calendar').val(datedir.replace('/', ''));
$('.kulapyres3-report .kulapyres3-calendar').datepicker({
    autoSize: true,
    dateFormat: 'yy-mm-dd',
    maxDate: today.toJSON().slice(0,10),
    onSelect: dateChange
});

function dateChange(selectValue) {
    qs.set('date', selectValue);
    window.location = window.location.pathname + '?' + qs.toString();
};

// Tables
$('.kulapyres3-report .kulapyres3-table').each(function() {
    let table = $(this);
    let total = table.data('total') ? table.data('total').split(',') : null;
    let range;

    let csvfile = prefix;
    if (handle) csvfile += handle + '/';
    if (table.data('csv').indexOf('Total.') == 0) {
        csvfile += table.data('csv');
    } else {
        csvfile += datedir.replace(/-/g, '/') + table.data('csv');
    }

    d3.csv(csvfile).then(function(csvdata) {
        let lines = csvdata.length;

        // trigger special table pre-rendering functions
        if (table.data('extract')) extractData(csvdata, table.data('extract'));
        if (table.data('heatmap')) range = getRange(csvdata);
        if (table.data('order'))
            csvdata.columns = sortColumns(csvdata.columns, table.data('order'));

        let cols = [];
        table.append('<table />')
        // build column headers list
        table.find('table').append('<thead />');
        table.find('table thead').append('<tr class="title-row" />');
        csvdata.columns.forEach(c => {
            let title = c.split('_')[0]; // title = text left of underscore
            if (title) {
                cols.push(c);
                table.find('.title-row').append('<th>' + title + '</th>');
            }
        });

        // Add right-most column header if data-total="row" specified
        if (total && total.indexOf('row') > -1) {
            table.find('.title-row').append('<td class="gap" /><th>' +
                csvdata.columns[0].split('/')[0] + '</th>');
        }

        // render columns data, row by row
        let rangeCol = [];
        table.find('table').append('<tbody />');
        csvdata.forEach((d, r) => {
            table.find('table tbody').append('<tr class="row'+r+'" />');
            cols.forEach((c, i) => {
                let value = '';
                if (table.data('empty-zero') && d[c] == 0 && i > 0) {
                    value = ''; // display empty if data-empty-zero and not first column
                } else if ((lines > 1 && i == 0 ) || d[c].indexOf('%') > -1) {
                    value = d[c]; // display without formatting
                } else if (d[c] != 'None') {
                    value = numeral(d[c]).format('0,0');
                }
                if (c == 'link') { // display href-img if column name is "link"
                    let src = d['_img'] ? d['_img'] : d[c];
                    value = '<div onmouseover="thumbOver(this);" \
                            onmouseout="thumbOut(this);"><a href="' +
                            d[c] + '" target="_blank"><img src="' + src +
                            '" height="20px" /></a></div>';
                }
                table.find('.row'+r).append('<td class="col'+i+'">' + value + '</td>');
                let cell = table.find('.row'+r+' .col'+i);
                if (range && i > 0 && value) {
                    setColor(range, value, cell);
                    cell.css({width: '10%'}); // spaced evenly during heatmap
                }
                if (table.data('empty-zero') && value == '') cell.css({border: 0});
            });

            // Add right-most column if data-total="row" specified
            if (total && total.indexOf('row') > -1) {
                let cols = _.compact(_.values(d).slice(1).map(m => { return parseInt(m); }));
                let value = numeral((total.indexOf('avg') > -1) ? _.mean(cols) : _.sum(cols)).format('0,0');
                table.find('.row'+r).append('<td class="gap" /><td class="total-col">' + value + '</td>');
                if (range) rangeCol.push(parseInt(value.replace(/,/, '')));
            }
        });
        if (rangeCol) {
            rangeCol.sort((a,b) => { return a - b; });
            csvdata.forEach((d, r) => {
                let cell = table.find('.row'+r+' .total-col');
                setColor(rangeCol, cell.text(), cell);
            });
        }

        // Add total-row if data-total="col" specified
        let rangeRow = [];
        if (total && total.indexOf('col') > -1) {
            table.find('table tbody').append('<tr><td class="gap" /></tr><tr class="total-row" />');
            cols.forEach((c, i) => {
                if (i == 0) {
                    table.find('.total-row').append('<th>' + c.split('/').slice(1) + '</th>');
                } else {
                    let rows = _.compact(_.map(csvdata, m => { return parseInt(m[c]); }));
                    let value = numeral((total.indexOf('avg') > -1) ? _.mean(rows) : _.sum(rows)).format('0,0');
                    table.find('.total-row').append('<td class="col'+i+'">' + value + '</td>');
                    if (range) rangeRow.push(parseInt(value.replace(/,/, '')));
                }
            });
            if (rangeRow) {
                rangeRow.sort((a,b) => { return a - b; });
                cols.forEach((c, i) => {
                    let cell = table.find('.total-row .col'+i);
                    setColor(rangeRow, cell.text(), cell);
                });
            }
        }
        // trigger special table post-rendering functions
        if (table.data('apply')) applyTables(table);
    });
    table.after('<div class="export"><a href="' + csvfile + '">Export Table Data</a></div>');
});

function thumbOut(e) {
    thumbModal(e, false);
}

function thumbOver(e) {
    thumbModal(e, true);
}

function thumbModal(e, display) {
    let thumb = $(e).find('img');
    let chart = thumb.parents('.kulapyres3-table');
    let modal = $('#' + chart.attr('id') + '-modal');
    modal.css({left: chart.position().left - 30, top: chart.position().top});
    if (display) {
        modal.find('img').attr('src', thumb.attr('src'));
        modal.show();
    } else {
        modal.hide();
    }
}

function setColor(range, value, cell) {
    let hue = range.indexOf(parseInt(value.replace(/,/, ''))) / range.length;
    let sat = '100%';
    let lum = '70%';
    if (hue == 0) lum = '40%';
    if (hue == (range.length-1)/range.length) {
        sat = '50%';
        lum = '40%';
    }
    cell.css({backgroundColor: 'hsl(' + hue*120 + ',' + sat + ',' + lum + ')'});
}

function getRange(data) {
    let values = _.flatten(_.map(data, d => {
        return _.compact(_.values(d).slice(1).map(m => { return parseInt(m); }));
    }));
    values.sort((a,b) => { return a - b; });
    return values;
}

function sortColumns(columns, order) {
    let cols = [ columns[0] ]; // assume first column is key
    let reorder = columns.slice(1);
    switch (order) {
        case 'reverse':
            reorder = reorder.reverse();
            break;
        case 'weekday':
            const weekday = {sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6};
            reorder = reorder.sort((a,b) => {
                return weekday[a.slice(0,3)] - weekday[b.slice(0,3)];
            });
            break;
    }
    cols = cols.concat(reorder);
    return cols;
}

function applyTables(table) {
    table.data('apply').split(',').forEach(apply => {
        switch (apply) {
            case 'datatables':
                table.find('table').DataTable({
                    info: table.data('info') || false,
                    paging: table.data('paging') || true,
                    pageLength: table.data('page-length') || 10,
                    searching: table.data('searching') || false,
                    lengthChange: table.data('length-change') || false
                });
                break;
        }
    });
}

// Graphs
$('.kulapyres3-report .kulapyres3-graph').each(function() {
    let graph = $(this);

    let csvfile = prefix;
    if (handle) csvfile += handle + '/';
    if (graph.data('csv').indexOf('Total.') == 0) {
        csvfile += graph.data('csv');
    } else {
        csvfile += datedir.replace(/-/g, '/') + graph.data('csv');
    }

    let basic = {
        axis: {"x":{"type":"timeseries","tick":{"cullable":false,"format":"%m/%d"}}},
        grid: {"y":{"show":true}},
        legend: {"show":true,"position":"bottom"},
        point: {"show":false},
        x: "date"
    }
    if (graph.data('axes') && Object.values(graph.data('axes')).indexOf('y2') > -1) {
        basic.axis.y2 = {show: true};
    }
    if (graph.data('days') || graph.data('keys')) {
        filterGraph(basic, csvfile, graph);
    } else {
        basicGraph(basic, csvfile, graph);
    }
    graph.after('<div class="export"><a href="' + csvfile + '">Export Graph Data</a></div>');
});

function basicGraph(basic, csvfile, graph) {
    let chart = c3.generate({
        axis: graph.data('axis') || basic.axis,
        bar: graph.data('bar'),
        bindto: '#' + graph.attr('id'),
        data: {
            axes: graph.data('axes'),
            groups: graph.data('groups'),
            type: graph.data('type'),
            types: graph.data('types'),
            url: csvfile,
            x: graph.data('x') || basic.x
        },
        grid: graph.data('grid') || basic.grid,
        legend: graph.data('legend') || basic.legend,
        point: graph.data('point') || basic.point
    });
}

function filterGraph(basic, csvfile, graph) {
    let crop = graph.data('days') ? moment().subtract(graph.data('days'), 'days').format('YYYY-MM-DD') : null;
    d3.csv(csvfile).then(function(csvdata) {
        if (crop) {
            csvdata = csvdata.filter(row => {
                return row.date && row.date >= crop;
            });
        }
        if (graph.data('extract')) extractData(csvdata, graph.data('extract'));
        let value = graph.data('keys') ? graph.data('keys').split(',') : Object.keys(csvdata[0]);
        let chart = c3.generate({
            axis: graph.data('axis') || basic.axis,
            bar: graph.data('bar'),
            bindto: '#' + graph.attr('id'),
            data: {
                axes: graph.data('axes'),
                groups: graph.data('groups'),
                type: graph.data('type'),
                types: graph.data('types'),
                json: csvdata,
                keys: {
                    x: graph.data('x') || basic.x,
                    value: value
                }
            },
            grid: graph.data('grid') || basic.grid,
            legend: graph.data('legend') || basic.legend,
            point: graph.data('point') || basic.point
        });
    });
}

function targetValue(target, value) {
    if (target.data('numeral')) {
        value = numeral(value).format(target.data('numeral'));
    }
    target.text(value);
}

function extractData(csvdata, extract, reply=false) {
    // using lodash to simplify/reduce logic here
    let response = []
    _.keys(extract).forEach(act => {
        if (act == 'change') {
            // potentially complex, better separate into another function
            extractChange(csvdata, extract.change);
        } else if (act == 'count') { // NOTE that this is different than Sum
            _.forEach(extract.count, (type, id) => {
                if (reply) {
                    response.push({id: id, val: csvdata.length});
                } else {
                    targetValue($(id), csvdata.length);
                }
            });
        } else if (act == 'last') {
            _.forEach(extract.last, (key, id) => {
                let last = _.last(csvdata);
                if (_.keys(last).indexOf(key))
                    if (reply) {
                        response.push({id: id, val: last[key]});
                    } else {
                        targetValue($(id), last[key]);
                    }
            });
        } else if (act == 'mean') {
            _.forEach(extract.mean, (key, id) => {
                let mean = _.meanBy(csvdata, c => {
                    return parseInt(c[key].replace('None', '0'));
                });
                if (reply) {
                    response.push({id: id, val: mean});
                } else {
                    targetValue($(id), _.round(mean));
                }
            });
        } else if (act == 'rowcol') { // obviously Table references
            _.forEach(extract.rowcol, (ref, id) => {
                let [r,c] = ref.split(',');
                targetValue($(id), csvdata[r][c]);
            });
        } else if (act == 'sum') {
            _.forEach(extract.sum, (key, id) => {
                let sum = _.sumBy(csvdata, c => {
                    if (key == "values") {
                        return _.sum(_.map(c, parseInt).slice(1));
                    } else {
                        return parseInt(c[key].replace('None', '0'));
                    }
                });
                if (reply) {
                    response.push({id: id, val: sum});
                } else {
                    targetValue($(id), sum);
                }
            });
        }
    });
    if (reply) return response
}

// extractChange replaced by simpler rowcol extraction
// leaving function for future reference logic
function extractChange(csvdata, change) {
    _.forEach(change, (extract, subset) => {
        if ((/^(\d+)days$/).test(subset)) {
            let days = subset.match(/^(\d+)days$/)[1];
            let now = _.last(csvdata)
            if (now && now.date) {
                let lastdate = moment(now.date).subtract(days, 'days').format('YYYY-MM-DD');
                let lastdata = csvdata.filter(row => {
                    return row.date && row.date > lastdate;
                });
                let last = extractData(lastdata, extract, reply=true);

                let prevdate = moment(lastdate).subtract(days, 'days').format('YYYY-MM-DD');
                let prevdata = csvdata.filter(row => {
                    return row.date && row.date > prevdate && row.date <= lastdate;
                });
                let prev = extractData(prevdata, extract, reply=true);

                let id = last[0].id;
                let p = prev[0].val;
                let l = last[0].val;
                targetValue($(id), numeral(100*(l-p)/p).format('0.0') + '%');
            }
        }
    });
}
