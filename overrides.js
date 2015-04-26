// Fix Combo box item selection on space key for 5.1.0
Ext.define('EXTJS_15043.form.field.ComboBox', {
    override: 'Ext.form.field.ComboBox',
    createPicker: function () {
        var picker = this.callParent();
        picker.getNavigationModel().navigateOnSpace = false;
        return picker;
    },
    onExpand: function() {
        var keyNav = this.getPicker().getNavigationModel();
        if (keyNav) {
            keyNav.enable();
        }
    }
});

Ext.define('EXTJS_15043.view.BoundListKeyNav', {
    override: 'Ext.view.BoundListKeyNav',
    navigateOnSpace: true,
    onKeySpace: function() {
        if (this.navigateOnSpace) {
            this.callSuper(arguments);
        }
        return true;
    }
});
