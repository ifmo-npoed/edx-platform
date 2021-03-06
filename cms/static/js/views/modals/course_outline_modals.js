/**
 * The CourseOutlineXBlockModal is a Backbone view that shows an editor in a modal window.
 * It has nested views: for release date, due date and grading format.
 * It is invoked using the editXBlock method and uses xblock_info as a model,
 * and upon save parent invokes refresh function that fetches updated model and
 * re-renders edited course outline.
 */
define(['jquery', 'backbone', 'underscore', 'gettext', 'js/views/baseview',
    'js/views/modals/base_modal', 'date', 'js/views/utils/xblock_utils',
    'js/utils/date_utils'
], function(
    $, Backbone, _, gettext, BaseView, BaseModal, date, XBlockViewUtils, DateUtils
) {
    'use strict';
    var CourseOutlineXBlockModal, SettingsXBlockModal, PublishXBlockModal, AbstractEditor, BaseDateEditor,
        ReleaseDateEditor, DueDateEditor, GradingEditor, PublishEditor, StaffLockEditor, WeightEditor;

    CourseOutlineXBlockModal = BaseModal.extend({
        events : {
            'click .action-save': 'save'
        },

        options: $.extend({}, BaseModal.prototype.options, {
            modalName: 'course-outline',
            modalType: 'edit-settings',
            addSaveButton: true,
            modalSize: 'med',
            viewSpecificClasses: 'confirm',
            editors: []
        }),

        initialize: function() {
            BaseModal.prototype.initialize.call(this);
            this.events = $.extend({}, BaseModal.prototype.events, this.events);
            this.template = this.loadTemplate('course-outline-modal');
            this.options.title = this.getTitle();
        },

        afterRender: function () {
            BaseModal.prototype.afterRender.call(this);
            this.initializeEditors();
        },

        initializeEditors: function () {
            this.options.editors = _.map(this.options.editors, function (Editor) {
                return new Editor({
                    parentElement: this.$('.modal-section'),
                    model: this.model,
                    xblockType: this.options.xblockType
                });
            }, this);
        },

        getTitle: function () {
            return '';
        },

        getIntroductionMessage: function () {
            return '';
        },

        getContentHtml: function() {
            return this.template(this.getContext());
        },

        save: function(event) {
            event.preventDefault();
            var requestData = this.getRequestData();
            if (!_.isEqual(requestData, { metadata: {} })) {
                XBlockViewUtils.updateXBlockFields(this.model, requestData, {
                    success: this.options.onSave
                });
            }
            this.hide();
        },

        /**
         * Return context for the modal.
         * @return {Object}
         */
        getContext: function () {
            return $.extend({
                xblockInfo: this.model,
                introductionMessage: this.getIntroductionMessage()
            });
        },

        /**
         * Return request data.
         * @return {Object}
         */
        getRequestData: function () {
            var requestData = _.map(this.options.editors, function (editor) {
                return editor.getRequestData();
            });

            return $.extend.apply(this, [true, {}].concat(requestData));
        }
    });

    SettingsXBlockModal = CourseOutlineXBlockModal.extend({
        getTitle: function () {
            return interpolate(
                gettext('%(display_name)s Settings'),
                { display_name: this.model.get('display_name') }, true
            );
        },

        getIntroductionMessage: function () {
            return interpolate(
                gettext('Change the settings for %(display_name)s'),
                { display_name: this.model.get('display_name') }, true
            );
        }
    });


    PublishXBlockModal = CourseOutlineXBlockModal.extend({
        events : {
            'click .action-publish': 'save'
        },

        initialize: function() {
            CourseOutlineXBlockModal.prototype.initialize.call(this);
            if (this.options.xblockType) {
                this.options.modalName = 'bulkpublish-' + this.options.xblockType;
            }
        },

        getTitle: function () {
            return interpolate(
                gettext('Publish %(display_name)s'),
                { display_name: this.model.get('display_name') }, true
            );
        },

        getIntroductionMessage: function () {
            return interpolate(
                gettext('Publish all unpublished changes for this %(item)s?'),
                { item: this.options.xblockType }, true
            );
        },

        addActionButtons: function() {
            this.addActionButton('publish', gettext('Publish'), true);
            this.addActionButton('cancel', gettext('Cancel'));
        }
    });


    AbstractEditor = BaseView.extend({
        tagName: 'section',
        templateName: null,
        initialize: function() {
            this.template = this.loadTemplate(this.templateName);
            this.parentElement = this.options.parentElement;
            this.render();
        },

        render: function () {
            var html = this.template($.extend({}, {
                xblockInfo: this.model,
                xblockType: this.options.xblockType
            }, this.getContext()));

            this.$el.html(html);
            this.parentElement.append(this.$el);
        },

        getContext: function () {
            return {};
        },

        getRequestData: function () {
            return {};
        }
    });

    BaseDateEditor = AbstractEditor.extend({
        // Attribute name in the model, should be defined in children classes.
        fieldName: null,

        events : {
            'click .clear-date': 'clearValue'
        },

        afterRender: function () {
            AbstractEditor.prototype.afterRender.call(this);
            this.$('input.date').datepicker({'dateFormat': 'm/d/yy'});
            this.$('input.time').timepicker({
                'timeFormat' : 'H:i',
                'forceRoundTime': true
            });
            if (this.model.get(this.fieldName)) {
                DateUtils.setDate(
                    this.$('input.date'), this.$('input.time'),
                    this.model.get(this.fieldName)
                );
            }
        }
    });

    DueDateEditor = BaseDateEditor.extend({
        fieldName: 'due',
        templateName: 'due-date-editor',
        className: 'modal-section-content has-actions due-date-input grading-due-date',

        getValue: function () {
            return DateUtils.getDate(this.$('#due_date'), this.$('#due_time'));
        },

        clearValue: function (event) {
            event.preventDefault();
            this.$('#due_time, #due_date').val('');
        },

        getRequestData: function () {
            return {
                metadata: {
                    'due': this.getValue()
                }
            };
        }
    });

    ReleaseDateEditor = BaseDateEditor.extend({
        fieldName: 'start',
        templateName: 'release-date-editor',
        className: 'edit-settings-release scheduled-date-input',
        startingReleaseDate: null,

        afterRender: function () {
            BaseDateEditor.prototype.afterRender.call(this);
            // Store the starting date and time so that we can determine if the user
            // actually changed it when "Save" is pressed.
            this.startingReleaseDate = this.getValue();
        },

        getValue: function () {
            return DateUtils.getDate(this.$('#start_date'), this.$('#start_time'));
        },

        clearValue: function (event) {
            event.preventDefault();
            this.$('#start_time, #start_date').val('');
        },

        getRequestData: function () {
            var newReleaseDate = this.getValue();
            if (JSON.stringify(newReleaseDate) === JSON.stringify(this.startingReleaseDate)) {
                return {};
            }
            return {
                metadata: {
                    'start': newReleaseDate
                }
            };
        }
    });

    GradingEditor = AbstractEditor.extend({
        templateName: 'grading-editor',
        className: 'edit-settings-grading',

        afterRender: function () {
            AbstractEditor.prototype.afterRender.call(this);
            this.setValue(this.model.get('format'));
        },

        setValue: function (value) {
            this.$('#grading_type').val(value);
        },

        getValue: function () {
            return this.$('#grading_type').val();
        },

        getRequestData: function () {
            return {
                'graderType': this.getValue()
            };
        },

        getContext: function () {
            return {
                graderTypes: JSON.parse(this.model.get('course_graders'))
            };
        }
    });

    PublishEditor = AbstractEditor.extend({
        templateName: 'publish-editor',
        className: 'edit-settings-publish',
        getRequestData: function () {
            return {
                publish: 'make_public'
            };
        }
    });

    StaffLockEditor = AbstractEditor.extend({
        templateName: 'staff-lock-editor',
        className: 'edit-staff-lock',
        isModelLocked: function() {
            return this.model.get('has_explicit_staff_lock');
        },

        isAncestorLocked: function() {
            return this.model.get('ancestor_has_staff_lock');
        },

        afterRender: function () {
            AbstractEditor.prototype.afterRender.call(this);
            this.setLock(this.isModelLocked());
        },

        setLock: function(value) {
            this.$('#staff_lock').prop('checked', value);
        },

        isLocked: function() {
            return this.$('#staff_lock').is(':checked');
        },

        hasChanges: function() {
            return this.isModelLocked() != this.isLocked();
        },

        getRequestData: function() {
            return this.hasChanges() ? {
                publish: 'republish',
                metadata: {
                    visible_to_staff_only: this.isLocked() ? true : null
                    }
                } : {};
        },

        getContext: function () {
            return {
                hasExplicitStaffLock: this.isModelLocked(),
                ancestorLocked: this.isAncestorLocked()
            };
        }
    });

    WeightEditor = AbstractEditor.extend({
        templateName: 'weight-editor',

        setValue: function (value) {
            this.$('#weight').val(value);
        },

        getValue: function () {
            return this.$('#weight').val();
        },

        getRequestData: function () {
            return {
                'metadata': {'weight': this.getValue()}
            };
         }
     });

    return {
        getModal: function (type, xblockInfo, options) {
            if (type === 'edit') {
                return this.getEditModal(xblockInfo, options);
            } else if (type === 'publish') {
                return this.getPublishModal(xblockInfo, options);
            }
        },

        getEditModal: function (xblockInfo, options) {
            var editors = [];

            if (xblockInfo.isChapter()) {
                editors = [ReleaseDateEditor, StaffLockEditor];
            } else if (xblockInfo.isSequential()) {
                editors = [ReleaseDateEditor, StaffLockEditor];
            } else if (xblockInfo.isVertical()) {
                editors = [GradingEditor, DueDateEditor, WeightEditor, StaffLockEditor];
            }

            return new SettingsXBlockModal($.extend({
                editors: editors,
                model: xblockInfo
            }, options));
        },

        getPublishModal: function (xblockInfo, options) {
            return new PublishXBlockModal($.extend({
                editors: [PublishEditor],
                model: xblockInfo
            }, options));
        }
    };
});
