Ext.define('Juris.ux.CGMapPanel', {
    extend: 'Ext.panel.Panel',

    requires: [
        'Ext.window.MessageBox'
    ],

    xtype: 'cgmappanel',

    markers: [],

    border: false,

    /**
     * private cache lookups
     */
    lastLookup: null,

    /**
     * type ahead dealy before we re-trigger address lookup
     */
    typeAheadDelay: 1000,

    /**
     * Minimal string length before we trigger address lookup
     */
    lookupMinLength: 5,

    /**
     * private
     */
    currentAddress: null,

    /**
     * private
     */
    populateCombo: false,

    /**
     * Enable Maximize tool button that will create a more advanced version of this component
     */
    showMaximizeButton: false,

    /**
     * If true, after address lookup it will set combo value to match marker on the map
     */
    setComboValue: false,

    /**
     * Enable directions service
     */
    useDirections: false,

    initComponent : function(){
        var me = this,
            cfg = me.initialConfig;

        Ext.applyIf(this,{
            header: {
                titlePosition: 1,
                items: [
                    {
                        xtype: 'combo',
                        triggerCls: Ext.baseCSSPrefix + 'form-clear-trigger',
                        store: Ext.create('Ext.data.Store', {
                            fields: ['formatted_address', 'id'],
                            listeners: {
                                datachanged: function(store){
                                    var combo = me.down('combo');

                                    if(me.populateCombo){
                                        me.populateCombo = false;

                                        var rec = store.getRange()[0];
                                        if(rec){
                                            combo.select(rec);
                                            combo.collapse();
                                            me.repositionMarker(rec.data || rec[0].data);
                                        }
                                    }else{
                                        combo.expand();
                                    }
                                }
                            }
                        }),
                        queryMode: 'local',
                        style: 'margin: -4px', //hack for proper fit in header (Neptune, but might adjust for other themes)
                        hideTrigger: true,
                        autoSelect: false,
                        enableKeyEvents: true,
                        displayField: 'formatted_address',
                        valueField: 'id',
                        width: 400,
                        listeners: {
                            select: function(combo, rec){
                                me.repositionMarker(rec.data || rec[0].data); // Ext 5.0 vs 5.1
                                me.fireEvent('addressselected', rec.data || rec[0].data); // Ext 5.0 vs 5.1
                            },
                            beforequery: function(qe){
                                // Force the query through for typeAhead
                                this.lastQuery = null;

                                // Force an empty filter so everything shows
                                qe.query = '';
                            },
                            keyup: me.onKeyup,
                            scope: me
                        },
                        //overload template method
                        onTriggerClick: function(field){
                            if(field){
                                me.resetCombo(field);
                            }
                        }
                    }
                ]
            }

        });

        if(cfg.showMaximizeButton){

            me.windowCfg = {
                xtype: 'cgmapwindow',
                maximized: true,
                autoShow: true,

                listeners: {
                    //sync with parent window
                    parentselected: function(data){
                        var combo = me.down('combo');

                        combo.getStore().setData([data]);
                        combo.select(data.formatted_address);
                        combo.collapse();
                        me.repositionMarker(data);

                    },
                    parentreset: function(){
                        var combo = me.down('combo');
                        me.resetCombo(combo);
                    }
                }
            };

            me.tools = [
                {
                    type: 'maximize',
                    handler: function() {
                        var winCfg = me.windowCfg;

                        Ext.apply(winCfg, {
                            initialAddress: me.currentAddress && me.currentAddress.formatted_address || cfg.center.geoCodeAddr
                        });

                        Ext.create(winCfg);
                    }
                }
            ];
        }

        this.callParent();
    },

    onBoxReady : function(){
        var me = this,
            center = me.center;

        this.callParent(arguments);

        if (center) {
            if (center.geoCodeAddr) {
                me.lookupCode(center.geoCodeAddr, center.marker);
            } else {
                me.createMap(center, me.marker || null);
            }
        } else {
            Ext.Error.raise('center is required');
        }
    },

    createMap: function(center, marker) {
        var me = this,
            options = Ext.apply({}, me.mapOptions),
            combo = me.down('combo'),
            newMarker;

        options = Ext.applyIf(options, {
            zoom: 14,
            center: center,
            mapTypeId: google.maps.MapTypeId.HYBRID
        });

        me.gmap = new google.maps.Map(me.body.dom, options);
        me.geocoder = new google.maps.Geocoder();

        if(me.useDirections){
            me.directionsService = new google.maps.DirectionsService();
            me.directionsDisplay = new google.maps.DirectionsRenderer();
            me.directionsDisplay.setMap(me.gmap);
        }

        if (marker) {
            newMarker = me.addMarker(Ext.applyIf(marker, {
                position: center
            }));

            me.markers.push(newMarker);
        }

        if(me.setComboValue && me.lastLookup.length > 0){
            combo.getStore().setData(me.lastLookup);
            combo.suspendEvent('change');
            combo.setValue(me.lastLookup[0].formatted_address);
            combo.resumeEvent('change');
            combo.collapse();
            combo.setHideTrigger(false);
        }
        me.fireEvent('mapready', this, me.gmap);
    },

    addMarker: function(marker) {
        marker = Ext.apply({
            map: this.gmap
        }, marker);

        if (!marker.position) {
            marker.position = new google.maps.LatLng(marker.lat, marker.lng);
        }
        var o =  new google.maps.Marker(marker);
        Ext.Object.each(marker.listeners, function(name, fn){
            google.maps.event.addListener(o, name, fn);
        });
        return o;
    },

    lookupCode : function(addr, marker) {
        var me = this;

        me.geocoder = new google.maps.Geocoder();
        me.geocoder.geocode({
            address: addr
        }, Ext.Function.bind(me.onLookupComplete, me, [marker], true));
    },

    onLookupComplete: function(data, response, marker){
        if (response != 'OK') {
            Ext.MessageBox.alert('Error', 'An error occured: "' + response + '"');
            return;
        }

        this.lastLookup = data;
        this.createMap(data[0].geometry.location, marker);
    },

    afterComponentLayout : function(w, h){
        this.callParent(arguments);
        this.redraw();
    },

    redraw: function(){
        var map = this.gmap;

        if (map) {
            google.maps.event.trigger(map, 'resize');
        }
    },

    setDirectionsRenderTarget: function(cmp){
        this.directionsDisplay.setPanel(cmp.el.dom);
    },

    calculateRoute: function(start, end){
        var me = this,
            request = {
                origin: start,
                destination: end,
                travelMode: google.maps.TravelMode.DRIVING
            };

        me.directionsService.route(request, function(response, status) {
            if (status == google.maps.DirectionsStatus.OK) {
                me.directionsDisplay.setDirections(response);
            }
        });
    },


    resetCombo: function(field){
        var me = this;

        me.currentAddress = null;
        field.getStore().removeAll();
        field.collapse();
        field.reset();
        field.setHideTrigger(true);

        me.fireEvent('addressreset');
    },

    repositionMarker: function(data){
        var me = this,
            marker;

        me.currentAddress = data;

        //set center
        me.gmap.setCenter(data.geometry.location);

        //remove all markers
        me.removeAllMarkers();

        //add marker
        marker = me.addMarker({
            position:data.geometry.location,
            title: data.formatted_address
        });

        me.markers.push(marker);
    },

    onKeyup: function(field, e){
        var me = this,
            value = field.getRawValue();

        //cleared out
        if(value.length === 0){
            field.getStore().removeAll();
            Ext.defer(function(){field.collapse();},10);
            field.setHideTrigger(true);
            if(me.typeAheadTask){
                //cancel any pending tasks
                me.typeAheadTask.cancel();
            }
            return true;
        }

        field.setHideTrigger(false);

        if (!me.typeAheadTask) {
            me.typeAheadTask = new Ext.util.DelayedTask(me.verifyAddress, me);
        }

        me.typeAheadTask.delay(me.typeAheadDelay, null, null, [value]);
    },

    verifyAddress: function(address){
        var me = this;

        if(address && address.substr(0, 8) !== 'extModel' && address.length > me.lookupMinLength - 1){
            me.geocoder.geocode({
                address: address
            }, Ext.Function.bind(me.onVerifyAddressComplete, me));
        }
    },

    onVerifyAddressComplete: function(data){
        this.down('combo').getStore().setData(data);
    },

    setAddress: function(address){
        this.populateCombo = true;
        this.verifyAddress(address);
    },

    /**
     * Adds traffic layer to the map
     * @param show
     */
    showTraffic: function(show){
        var me = this;

        if(!me.trafficLayer){
            me.trafficLayer = new google.maps.TrafficLayer();
        }

        me.trafficLayer.setMap(show || (show === undefined) ? me.gmap : null);
    },

    removeAllMarkers: function() {
        var me = this;
        if (me.markers.length > 0) {

            Ext.each(me.markers, function (marker) {
                marker.setMap(null);
                marker = null;
            }, me);

            me.markers = [];
        }
    },

    destroy: function(){
        var me = this;

        //Make sure we clean up google items from component first.
        //It might be an extra step, but it's a good practice to ensure proper memory release
        if(me.markers){
            me.removeAllMarkers();
        }

        if(me.trafficLayer){
            me.trafficLayer = null;
        }

        if(me.geocoder){
            me.geocoder = null;
        }

        if(me.useDirections){
            me.directionsService = null;
            me.directionsDisplay = null;
        }

        if(me.gmap){
            me.gmap = null;
        }

        me.lastLookup = null;

        me.callParent();
    }
});
