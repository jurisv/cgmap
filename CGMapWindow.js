Ext.define('Juris.ux.CGMapWindow', {
    extend: 'Ext.window.Window',

    xtype: 'cgmapwindow',

    requires: [
        'Juris.ux.CGMapPanel'
    ],

    maximized: true,

    layout: 'border',

    closable: true,

    title: 'Google Map Route',

    /**
     * String. Will apply to the center as well as set the marker.
     * The resulting address will be stored in combo and becomes the current value
     */
    initialAddress: null,

    /**
     * If true, after address lookup it will set combo value to match marker on the map
     */
    setComboValue: true,

    /**
     * Address to use for setCenter on the map if initialAddress is not provided
     */
    defaultAddress: 'Bay area, CA',

    lookupMinLength: 5,

    initComponent: function(){
        var me = this,
            cfg = me.initialConfig;

        Ext.applyIf(me, {
            items: [
                {
                    region: 'west',
                    xtype: 'form',
                    width: 380,
                    layout: {
                        type:'vbox',
                        align: 'stretch'
                    },
                    collapsible: true,
                    //collapsed: true,
                    split: true,
                    title: 'Navigation',
                    bodyPadding: 5,
                    items:[
                        {
                            xtype:'combo',
                            name: 'start',
                            fieldLabel: 'From',
                            triggerCls: Ext.baseCSSPrefix + 'form-clear-trigger',
                            store: Ext.create('Ext.data.Store', {
                                fields: ['formatted_address', 'id']
                            }),
                            queryMode: 'local',
                            hideTrigger: true,
                            autoSelect: false,
                            enableKeyEvents: true,
                            displayField: 'formatted_address',
                            valueField: 'formatted_address',
                            listeners: {
                                beforequery: function(qe) {
                                    // Force the query through for typeAhead
                                    this.lastQuery = null;

                                    // Force an empty filter so everything shows
                                    qe.query = '';
                                },
                                keyup: me.onKeyup,
                                scope: me
                            },
                            onTriggerClick: function(field){
                                if(field){
                                    field.reset();
                                    field.setHideTrigger(true);
                                }
                            }
                        },
                        {
                            xtype:'combo',
                            name: 'end',
                            fieldLabel: 'To',
                            triggerCls: Ext.baseCSSPrefix + 'form-clear-trigger',
                            store: Ext.create('Ext.data.Store', {
                                fields: ['formatted_address', 'id']
                            }),
                            queryMode: 'local',
                            hideTrigger: true,
                            autoSelect: false,
                            enableKeyEvents: true,
                            displayField: 'formatted_address',
                            valueField: 'formatted_address',
                            listeners: {
                                beforequery: function(qe) {
                                    // Force the query through for typeAhead
                                    this.lastQuery = null;

                                    // Force an empty filter so everything shows
                                    qe.query = '';
                                },
                                keyup: me.onKeyup,
                                scope: me
                            },
                            onTriggerClick: function(field){
                                if(field){
                                    field.reset();
                                    field.setHideTrigger(true);
                                }
                            }
                        },{
                            xtype:'toolbar',
                            items:[
                                {
                                    text:'Traffic OFF',
                                    enableToggle: true,
                                    allowDepress: true,
                                    listeners:{
                                        click: function(bt){
                                            bt.up('cgmapwindow').getMap().showTraffic(bt.pressed);
                                        },
                                        toggle: function(field, pressed){
                                            field.setText(pressed ? 'Traffic ON' : 'Traffic OFF');
                                        }
                                    }
                                },
                                '->',
                                {
                                    text: 'Route',
                                    handler: function(bt){
                                        var values = bt.up('form').getForm().getValues(),
                                            map = bt.up('cgmapwindow').getMap();

                                        map.calculateRoute(values.start, values.end);
                                    }
                                }
                            ]
                        },
                        {
                            //create scrollable container with placeholder for Turn by turn navigation
                            xtype:'container',
                            flex: 1,
                            items:[
                                {
                                    xtype:'component',
                                    style:'height: 100%;overflow: auto;',
                                    itemId: 'directions'
                                }
                            ]

                        }
                    ]
                },
                {
                    region: 'center',
                    xtype: 'cgmappanel',
                    setComboValue: true,
                    center: {
                        geoCodeAddr: cfg.initialAddress ? cfg.initialAddress : me.defaultAddress,
                        marker: {
                            title: cfg.initialAddress ? cfg.initialAddress : me.defaultAddress
                        }
                    },
                    mapOptions: {
                        mapTypeId: google.maps.MapTypeId.ROADMAP
                    },
                    useDirections: true,
                    listeners: {
                        mapready: function(){
                            me.getMap().setDirectionsRenderTarget(me.down('#directions'));
                        },
                        //we pass trough events
                        addressselected: function(data){ me.fireEvent('parentselected', data);},
                        addressreset: function(data){ me.fireEvent('parentreset', data);}
                    }
                }
            ]
        });

        me.callParent();
    },

    getMap: function(){
        return this.down('cgmappanel');
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

        me.typeAheadTask.delay(me.typeAheadDelay, null, null, [value, field]);
    },

    verifyAddress: function(address, target){
        var me = this;

        if(address && address.substr(0, 8) !== 'extModel' && address.length > me.lookupMinLength - 1){
            me.geocoder = new google.maps.Geocoder();
            me.geocoder.geocode({
                address: address
            }, Ext.Function.bind(me.onVerifyAddressComplete, me, [target], true));
        }
    },

    onVerifyAddressComplete: function(data, result, target){
        target.getStore().setData(data);
        target.expand();
    }
});
