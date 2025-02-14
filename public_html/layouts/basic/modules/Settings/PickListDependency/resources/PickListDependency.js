/*+***********************************************************************************
 * The contents of this file are subject to the vtiger CRM Public License Version 1.0
 * ("License"); You may not use this file except in compliance with the License
 * The Original Code is:  vtiger CRM Open Source
 * The Initial Developer of the Original Code is vtiger.
 * Portions created by vtiger are Copyright (C) vtiger.
 * All Rights Reserved.
 *************************************************************************************/
'use strict';

jQuery.Class(
	'Settings_PickListDependency_Js',
	{
		//holds the picklist dependency instance
		pickListDependencyInstance: false,
		/**
		 * This function used to trigger Delete picklist dependency
		 */
		triggerDelete: function (event, dependencyId) {
			event.stopPropagation();
			let currentTrEle = jQuery(event.currentTarget).closest('tr');
			let instance = Settings_PickListDependency_Js.pickListDependencyInstance;

			app.showConfirmModal({
				title: app.vtranslate('JS_LBL_ARE_YOU_SURE_YOU_WANT_TO_DELETE'),
				confirmedCallback: () => {
					instance.deleteDependency(dependencyId).done(function (data) {
						var params = {};
						params.text = app.vtranslate('JS_DEPENDENCY_DELETED_SUEESSFULLY');
						Settings_Vtiger_Index_Js.showMessage(params);
						currentTrEle.fadeOut('slow').remove();
					});
				}
			});
		}
	},
	{
		//constructor
		init: function () {
			Settings_PickListDependency_Js.pickListDependencyInstance = this;
		},
		//holds the listview forModule
		listViewForModule: '',
		//holds the updated sourceValues while editing dependency
		updatedSourceValues: [],
		//holds the new mapping of source values and target values
		valueMapping: [],
		//holds the list of selected source values for dependency
		selectedSourceValues: [],
		/*
		 * function to show editView for Add/Edit Dependency
		 * @params: module - selected module
		 *			sourceField - source picklist
		 *			secondField - target picklist
		 */
		showEditView: function (sourceModule, pickListDependencyId = '') {
			let aDeferred = jQuery.Deferred();
			let progressIndicatorElement = jQuery.progressIndicator({
				position: 'html',
				blockInfo: {
					enabled: true
				}
			});
			let params = {};
			params['module'] = app.getModuleName();
			params['parent'] = app.getParentModuleName();
			params['view'] = 'Edit';
			params['recordId'] = pickListDependencyId;
			params['sourceModule'] = sourceModule;
			AppConnector.requestPjax(params)
				.done(function (data) {
					progressIndicatorElement.progressIndicator({ mode: 'hide' });
					var container = jQuery('.contentsDiv');
					container.html(data);
					//register all select2 Elements
					App.Fields.Picklist.showSelect2ElementView(container.find('select.select2'), {
						dropdownCss: { 'z-index': 0 }
					});
					aDeferred.resolve(data);
				})
				.fail(function (error) {
					progressIndicatorElement.progressIndicator({ mode: 'hide' });
					aDeferred.reject(error);
				});
			return aDeferred.promise();
		},
		/**
		 * Function to get the Dependency graph based on selected module
		 */
		getModuleDependencyGraph: function (form) {
			let thisInstance = this;
			form.find('[name="sourceModule"]').on('change', function () {
				let forModule = form.find('[name="sourceModule"]').val();
				thisInstance.showEditView(forModule).done(function (data) {
					thisInstance.registerAddViewEvents();
				});
			});
		},
		/**
		 * Register change event for picklist fields in add/edit picklist dependency
		 */
		registerPicklistFieldsChangeEvent: function (form) {
			var thisInstance = this;
			form.find('[name="sourceField"],[name="secondField"],[name="thirdField"]').on('change', function () {
				thisInstance.checkValuesForDependencyGraph(form);
			});
		},
		/**
		 * Function used to check the selected picklist fields are valid before showing dependency graph
		 */
		checkValuesForDependencyGraph: function (form) {
			let thisInstance = this;
			let sourceField = form.find('[name="sourceField"]');
			let secondField = form.find('[name="secondField"]');
			let thirdField = form.find('[name="thirdField"]').length > 0 ? form.find('[name="thirdField"]') : false;

			let select2SourceField = app.getSelect2ElementFromSelect(sourceField);
			let select2SecondField = app.getSelect2ElementFromSelect(secondField);
			let select2ThirdField = thirdField ? app.getSelect2ElementFromSelect(thirdField) : '';

			let sourceFieldValue = sourceField.val();
			let secondFieldValue = secondField.val();
			let thirdFieldValue = thirdField ? thirdField.val() : '';
			let dependencyGraph = jQuery('#dependencyGraph');

			if (
				sourceFieldValue != '' &&
				secondFieldValue != '' &&
				(thirdField === false || (thirdField && thirdFieldValue != ''))
			) {
				form.find('.errorMessage').addClass('d-none');
				let resultMessage = app.vtranslate('JS_SOURCE_AND_TARGET_FIELDS_SHOULD_NOT_BE_SAME');
				if (sourceFieldValue == secondFieldValue) {
					select2SecondField.validationEngine('showPrompt', resultMessage, 'error', 'topLeft', true);
					dependencyGraph.html('');
				} else if (thirdField && (sourceFieldValue == thirdFieldValue || secondFieldValue == thirdFieldValue)) {
					if (select2ThirdField) {
						select2ThirdField.validationEngine('showPrompt', resultMessage, 'error', 'topLeft', true);
					}
				} else {
					select2SourceField.validationEngine('hide');
					select2SecondField.validationEngine('hide');
					if (select2ThirdField) {
						select2ThirdField.validationEngine('hide');
					}

					let sourceModule = form.find('[name="sourceModule"]').val();
					let progressIndicatorElement = jQuery.progressIndicator({
						position: 'html',
						blockInfo: {
							enabled: true
						}
					});

					thisInstance
						.checkCyclicDependencyExists(sourceModule, sourceFieldValue, secondFieldValue, thirdFieldValue)
						.done(function (data) {
							var result = data['result'];
							if (!result['result']) {
								thisInstance.addNewDependencyPickList();
								progressIndicatorElement.progressIndicator({ mode: 'hide' });
							} else {
								progressIndicatorElement.progressIndicator({ mode: 'hide' });
								form.find('.errorMessage').removeClass('d-none');
								form.find('.cancelAddView').removeClass('d-none');
								dependencyGraph.html('');
								thisInstance.registerAddViewEvents();
							}
						})
						.fail(function (error, err) {
							progressIndicatorElement.progressIndicator({ mode: 'hide' });
						});
				}
			} else {
				form.find('.errorMessage').addClass('d-none');
				let result = app.vtranslate('JS_SELECT_SOME_VALUE');
				if (sourceFieldValue == '') {
					select2SourceField.validationEngine('showPrompt', result, 'error', 'topLeft', true);
				} else if (secondFieldValue == '') {
					select2SecondField.validationEngine('showPrompt', result, 'error', 'topLeft', true);
				} else if (thirdField && secondFieldValue == '') {
					select2ThirdField.validationEngine('showPrompt', result, 'error', 'topLeft', true);
				}
			}
		},
		/**
		 * Function used to check the cyclic dependency of the selected picklist fields
		 * @params: sourceModule - selected module
		 *            sourceFieldValue - source picklist value
		 *            secondFieldValue - target picklist value
		 */
		checkCyclicDependencyExists: function (sourceModule, sourceFieldValue, secondFieldValue, thirdFieldValue) {
			let aDeferred = jQuery.Deferred();
			let params = {};
			params['mode'] = 'checkCyclicDependencyExists';
			params['module'] = app.getModuleName();
			params['parent'] = app.getParentModuleName();
			params['action'] = 'Index';
			params['sourceModule'] = sourceModule;
			params['sourcefield'] = sourceFieldValue;
			params['secondField'] = secondFieldValue;
			params['thirdField'] = thirdFieldValue;

			AppConnector.request(params).done(
				function (data) {
					aDeferred.resolve(data);
				},
				function (error, err) {
					aDeferred.reject();
				}
			);
			return aDeferred.promise();
		},
		/**
		 * Function used to show the new picklist dependency graph
		 * @params: sourceModule - selected module
		 *            sourceFieldValue - source picklist value
		 *            secondFieldValue - target picklist value
		 */
		addNewDependencyPickList: function () {
			var thisInstance = this;
			var dependencyGraph = $('#dependencyGraph');
			thisInstance.updatedSourceValues = [];
			let form = jQuery('#pickListDependencyForm');
			AppConnector.request({
				mode: 'getDependencyGraph',
				module: app.getModuleName(),
				parent: app.getParentModuleName(),
				view: 'IndexAjax',
				sourceModule: form.find('[name="sourceModule"] option:selected').val(),
				sourcefield: form.find('[name="sourceField"] option:selected').val(),
				secondField: form.find('[name="secondField"] option:selected').val(),
				thirdField: form.find('[name="thirdField"] option:selected').val()
			}).done(function (data) {
				dependencyGraph.html(data).css({ padding: '10px', border: '1px solid #ddd', background: '#fff' });
				thisInstance.registerDependencyGraphEvents();
				thisInstance.registerEventsForThreeFields();
				App.Fields.Picklist.showSelect2ElementView(dependencyGraph.find('select.select2'));
			});
		},
		/**
		 * This function will delete the pickList Dependency
		 * @params: module - selected module
		 *            sourceField - source picklist value
		 *            secondField - target picklist value
		 */
		deleteDependency: function (dependencyId) {
			let aDeferred = jQuery.Deferred();
			let params = {};
			params['module'] = app.getModuleName();
			params['parent'] = app.getParentModuleName();
			params['action'] = 'DeleteAjax';
			params['recordId'] = dependencyId;
			AppConnector.request(params)
				.done(function (data) {
					aDeferred.resolve(data);
				})
				.fail(function (error, err) {
					aDeferred.reject(error, err);
				});
			return aDeferred.promise();
		},
		/**
		 * Function used to show cancel link in add view and register click event for cancel
		 */
		registerCancelAddView: function (form) {
			var thisInstance = this;
			var cancelDiv = form.find('.cancelAddView');
			cancelDiv.removeClass('d-none');
			cancelDiv.find('.cancelLink').on('click', function () {
				thisInstance.loadListViewContents(thisInstance.listViewForModule);
			});
		},
		/**
		 * Register all the events related to addView of picklist dependency
		 */
		registerAddViewEvents: function () {
			let form = jQuery('#pickListDependencyForm');
			this.registerCancelAddView(form);
			this.getModuleDependencyGraph(form);
			this.registerPicklistFieldsChangeEvent(form);
			this.registerSubmitEvent();
			this.registerAddThirdField();
		},
		/**
		 * Register all the events in editView of picklist dependency
		 */
		registerDependencyGraphEvents: function () {
			var thisInstance = this;
			var form = jQuery('#pickListDependencyForm');
			var dependencyGraph = jQuery('#dependencyGraph');
			form.find('.cancelAddView').addClass('d-none');
			thisInstance.registersecondFieldsClickEvent(dependencyGraph);
			thisInstance.registersecondFieldsUnmarkAll(dependencyGraph);
			thisInstance.registerSelectSourceValuesClick(dependencyGraph);
			thisInstance.registerCancelDependency(form);
		},
		/**
		 * Register all the events related to listView of picklist dependency
		 */
		registerListViewEvents: function () {
			var thisInstance = this;
			var forModule = jQuery('.contentsDiv').find('.pickListSupportedModules').val();
			thisInstance.listViewForModule = forModule;
			thisInstance.registerSourceModuleChangeEvent();
		},
		/**
		 * Register the click event for cancel picklist dependency changes
		 */
		registerCancelDependency: function (form) {
			var thisInstance = this;
			//Register click event for cancel link
			var cancelDependencyLink = form.find('.cancelDependency');
			cancelDependencyLink.on('click', function () {
				thisInstance.loadListViewContents(thisInstance.listViewForModule);
			});
		},
		/**
		 * Register the click event for target fields in dependency graph
		 */
		registersecondFieldsClickEvent: function (dependencyGraph) {
			var thisInstance = this;
			thisInstance.updatedSourceValues = [];
			dependencyGraph.find('td.picklistValueMapping').on('click', function (e) {
				var currentTarget = jQuery(e.currentTarget);
				var sourceValue = currentTarget.data('sourceValue');
				if (jQuery.inArray(sourceValue, thisInstance.updatedSourceValues) == -1) {
					thisInstance.updatedSourceValues.push(sourceValue);
				}
				if (currentTarget.hasClass('selectedCell')) {
					currentTarget.addClass('unselectedCell').removeClass('selectedCell');
				} else {
					currentTarget.addClass('selectedCell').removeClass('unselectedCell');
				}
			});
		},
		registersecondFieldsUnmarkAll: function (dependencyGraph) {
			var thisInstance = this;
			thisInstance.updatedSourceValues = [];
			dependencyGraph.find('.unmarkAll').on('click', function (e) {
				dependencyGraph.find('td.picklistValueMapping').each(function (index) {
					var currentTarget = jQuery(this);
					var sourceValue = currentTarget.data('sourceValue');
					if (jQuery.inArray(sourceValue, thisInstance.updatedSourceValues) == -1) {
						thisInstance.updatedSourceValues.push(sourceValue);
					}
					currentTarget.addClass('unselectedCell').removeClass('selectedCell');
				});
			});
		},
		/**
		 * Function used to update the value mapping to save the picklist dependency
		 */
		updateValueMapping: function (dependencyGraph) {
			var thisInstance = this;
			thisInstance.valueMapping = [];
			var sourceValuesArray = thisInstance.updatedSourceValues;
			var dependencyTable = dependencyGraph.find('.pickListDependencyTable');
			for (var key in sourceValuesArray) {
				let encodedSourceValue;
				if (typeof sourceValuesArray[key] == 'string') {
					encodedSourceValue = sourceValuesArray[key].replace(/"/g, '\\"');
				} else {
					encodedSourceValue = sourceValuesArray[key];
				}
				var selectedTargetValues = dependencyTable
					.find('td[data-source-value="' + encodedSourceValue + '"]')
					.filter('.selectedCell');
				var targetValues = [];
				if (selectedTargetValues.length > 0) {
					jQuery.each(selectedTargetValues, function (index, element) {
						targetValues.push(jQuery(element).data('targetValue'));
					});
				} else {
					targetValues.push('');
				}
				thisInstance.valueMapping.push({
					sourcevalue: sourceValuesArray[key],
					targetvalues: targetValues
				});
			}
		},
		/**
		 * Register click event for select source values button in add/edit view
		 */
		registerSelectSourceValuesClick(dependencyGraph) {
			dependencyGraph.find('button.sourceValues').on('click', () => {
				const selectSourceValues = dependencyGraph.find('.modalCloneCopy');
				const clonedContainer = selectSourceValues.clone(true, true).removeClass('modalCloneCopy');
				app.showModalWindow(
					clonedContainer,
					(data) => {
						data.find('.sourcePicklistValuesModal').removeClass('d-none');
						data.find('[name="saveButton"]').on('click', (e) => {
							this.selectedSourceValues = [];
							const sourceValues = data.find('.sourceValue');
							$.each(sourceValues, (index, ele) => {
								const element = $(ele);
								const elementId = element.attr('id');
								const hiddenElement = selectSourceValues.find('#' + elementId);
								if (element.is(':checked')) {
									this.selectedSourceValues.push(element.val());
									hiddenElement.prop('checked', true);
								} else {
									hiddenElement.prop('checked', false);
								}
							});
							app.hideModalWindow();
							this.loadMappingForSelectedValues(dependencyGraph);
						});
					},
					{ width: '1000px' }
				);
			});
		},
		/**
		 * Function used to load mapping for selected picklist fields
		 */
		loadMappingForSelectedValues: function (dependencyGraph) {
			var thisInstance = this;
			var allSourcePickListValues = JSON.parse(dependencyGraph.find('.allSourceValues').val());
			var dependencyTable = dependencyGraph.find('.js-picklist-dependency-table');
			for (var key in allSourcePickListValues) {
				if (typeof allSourcePickListValues[key] == 'string') {
					var encodedSourcePickListValue = allSourcePickListValues[key].replace(/"/g, '\\"');
				} else {
					encodedSourcePickListValue = allSourcePickListValues[key];
				}
				var mappingCells = dependencyTable.find('[data-source-value="' + encodedSourcePickListValue + '"]');
				if (jQuery.inArray(allSourcePickListValues[key], thisInstance.selectedSourceValues) == -1) {
					mappingCells.hide();
				} else {
					mappingCells.show();
				}
			}
		},
		/**
		 * This function will save the picklist dependency details
		 */
		savePickListDependency: function (mapping) {
			var form = jQuery('#pickListDependencyForm');
			const self = this;
			let progressIndicatorElement = $.progressIndicator({
					position: 'html',
					blockInfo: {
						enabled: true
					}
				}),
				params = form.serializeFormData();
			params['module'] = app.getModuleName();
			params['parent'] = app.getParentModuleName();
			params['action'] = 'SaveAjax';
			params['mapping'] = mapping;
			AppConnector.request(params)
				.done(function (data) {
					if (data['success']) {
						progressIndicatorElement.progressIndicator({ mode: 'hide' });
						Vtiger_Helper_Js.showMessage({
							text: app.vtranslate('JS_PICKLIST_DEPENDENCY_SAVED'),
							type: 'success'
						});
						self.loadListViewContents(params['sourceModule']);
					}
				})
				.fail(function (error) {
					progressIndicatorElement.progressIndicator({ mode: 'hide' });
				});
		},
		/**
		 * This function will load the listView contents after Add/Edit picklist dependency
		 */
		loadListViewContents: function (forModule) {
			var thisInstance = this;
			var progressIndicatorElement = jQuery.progressIndicator({
				position: 'html',
				blockInfo: {
					enabled: true
				}
			});
			var params = {};
			params['module'] = app.getModuleName();
			params['parent'] = app.getParentModuleName();
			params['view'] = 'List';
			params['forModule'] = forModule;

			AppConnector.requestPjax(params)
				.done(function (data) {
					progressIndicatorElement.progressIndicator({ mode: 'hide' });
					//replace the new list view contents
					jQuery('.contentsDiv').html(data);
					App.Fields.Picklist.changeSelectElementView(jQuery('.contentsDiv'));
					thisInstance.registerListViewEvents();
				})
				.fail(function (error, err) {
					progressIndicatorElement.progressIndicator({ mode: 'hide' });
				});
		},

		/**
		 * register change event for source module in add/edit picklist dependency
		 */
		registerSourceModuleChangeEvent: function () {
			var thisInstance = this;
			var container = jQuery('.contentsDiv');
			container.find('.pickListSupportedModules').on('change', function (e) {
				var currentTarget = jQuery(e.currentTarget);
				var forModule = currentTarget.val();
				thisInstance.loadListViewContents(forModule);
			});
		},
		/**
		 * register the form submit event
		 */
		registerSubmitEvent: function () {
			var thisInstance = this;
			var form = jQuery('#pickListDependencyForm');
			var dependencyGraph = jQuery('#dependencyGraph');
			form.on('submit', function (e) {
				e.preventDefault();
				try {
					thisInstance.updateValueMapping(dependencyGraph);
				} catch (e) {
					app.showAlert(e.message);
					return;
				}
				if (form.find('.editDependency').val() != 'true' && thisInstance.valueMapping.length < 1) {
					var params = {};
					params.text = app.vtranslate('JS_PICKLIST_DEPENDENCY_NO_SAVED');
					params.type = 'info';
					Settings_Vtiger_Index_Js.showMessage(params);
				} else {
					thisInstance.savePickListDependency(JSON.stringify(thisInstance.valueMapping));
				}
			});
		},
		/**
		 * Action for adding third picklist field
		 */
		registerAddThirdField: function () {
			let container = jQuery('.js-picklist-dependent-container');
			container.find('.js-add-next-level-field').on('click', () => {
				let params = this.getDefaultParamsForThirdField();
				params.thirdField = true;
				let progress = jQuery.progressIndicator();
				AppConnector.request(params)
					.done((data) => {
						let dependentFieldsContainer = container.find('.js-dependent-fields');
						progress.progressIndicator({ mode: 'hide' });
						dependentFieldsContainer.html(data);
						App.Fields.Picklist.showSelect2ElementView(dependentFieldsContainer.find('select.select2'));
						this.checkValuesForDependencyGraph(this.form);
						this.registerPicklistFieldsChangeEvent(this.form);
						container.find('#dependencyGraph').html('');
					})
					.fail((_) => {
						app.showNotify({ text: app.vtranslate('JS_ERROR'), type: 'error' });
						progress.progressIndicator({ mode: 'hide' });
					});
			});
		},
		/**
		 * Get default params
		 * @returns object
		 */
		getDefaultParamsForThirdField() {
			let params = {
				module: this.form.find('[name="module"]').length
					? this.form.find('[name="module"]').val()
					: app.getModuleName(),
				parent: app.getParentModuleName(),
				sourceModule: this.form.find('[name="sourceModule"]').val(),
				view: 'DependentFields'
			};
			return params;
		},
		/**
		 * Register save picklist dependencies for three fields
		 */
		registerSaveDependentPicklist() {
			this.container.find('.js-save-dependent-picklists').on('click', () => {
				this.setPicklistDependencies(true);
				let picklistDependencies = this.container.find('.js-picklist-dependencies-data').val();
				if (picklistDependencies !== '{}') {
					this.savePickListDependency(picklistDependencies);
				} else {
					Settings_Vtiger_Index_Js.showMessage({
						text: app.vtranslate('JS_PICKLIST_DEPENDENCY_NO_SAVED'),
						type: 'info'
					});
				}

				return;
			});
		},
		/**
		 * Register change source picklist value
		 */
		registerChangeSourceValue() {
			this.container.find('.js-source-field-value').on('change', () => {
				this.setPicklistDependencies();
				this.clearAllMarkedValues();
				this.setMarkedValues();
			});
		},
		/**
		 * Set picklist dependencies
		 * @param bool currentSelectedValue
		 */
		setPicklistDependencies(currentSelectedValue = false) {
			if (this.form.find('.thirdField').val() !== '') {
				const dependencyTable = this.container.find('.js-picklist-dependency-table');
				let selectedOldSourceData = dependencyTable.find('.js-source-field-value option[data-old-source-value]');
				let sourceFieldValue = dependencyTable.find('.js-source-field-value option:selected').val();
				let selectedSourceValue = selectedOldSourceData.attr('data-old-source-value');
				if (currentSelectedValue) {
					selectedSourceValue = sourceFieldValue;
				}
				let picklistDependencies =
					this.container.find('.js-picklist-dependencies-data').val() !== ''
						? JSON.parse(this.container.find('.js-picklist-dependencies-data').val())
						: {};

				dependencyTable.find('.js-second-field-value').each(function (_index, element) {
					let secondFieldValue = $(element).attr('data-source-value').replace(/"/g, '\\"');
					if (secondFieldValue) {
						let allValuesInColumn = dependencyTable.find('td[data-source-value="' + secondFieldValue + '"]');
						let selectedTargetValues = dependencyTable
							.find('td[data-source-value="' + secondFieldValue + '"]')
							.filter('.selectedCell');
						let targetValues = [];
						if (selectedTargetValues.length > 0 && selectedTargetValues.length !== allValuesInColumn.length) {
							jQuery.each(selectedTargetValues, function (_index, element) {
								targetValues.push(jQuery(element).data('targetValue'));
							});

							if (picklistDependencies[selectedSourceValue] === undefined) {
								picklistDependencies[selectedSourceValue] = {};
							}
							picklistDependencies[selectedSourceValue][secondFieldValue] = targetValues;
						}
						if (
							selectedTargetValues.length === 0 &&
							picklistDependencies[selectedSourceValue] !== undefined &&
							picklistDependencies[selectedSourceValue][secondFieldValue] !== undefined
						) {
							picklistDependencies[selectedSourceValue][secondFieldValue] = {};
						}
					}
				});
				selectedOldSourceData.attr('data-old-source-value', sourceFieldValue);
				this.container.find('.js-picklist-dependencies-data').val(JSON.stringify(picklistDependencies));
			}
		},
		clearAllMarkedValues() {
			const dependencyTable = this.container.find('.js-picklist-dependency-table');
			let selectedTargetValues = dependencyTable.find('.picklistValueMapping').filter('.selectedCell');
			if (selectedTargetValues.length > 0) {
				jQuery.each(selectedTargetValues, function (_index, element) {
					jQuery(element).removeClass('selectedCell');
				});
			}
		},
		/**
		 * Set marked picklist values
		 */
		setMarkedValues() {
			let picklistDependencies = this.container.find('.js-picklist-dependencies-data').val();
			if (picklistDependencies !== '') {
				let sourceFieldValue = this.container.find('.js-source-field-value option:selected').val();
				let targetValues = {};
				let secondFieldValue = '';
				let parsedValues = JSON.parse(picklistDependencies);
				const dependencyTable = this.container.find('.js-picklist-dependency-table');
				for (let sourceMappedValue of Object.keys(parsedValues)) {
					if (sourceFieldValue === sourceMappedValue) {
						targetValues = parsedValues[sourceMappedValue];
						for (let secondValueKey of Object.keys(targetValues)) {
							for (const selectedThirdValue of targetValues[secondValueKey]) {
								secondFieldValue = dependencyTable
									.find(
										'td[data-source-value="' + secondValueKey + '"][data-target-value="' + selectedThirdValue + '"]'
									)
									.addClass('selectedCell')
									.removeClass('unselectedCell');
							}
						}
					}
				}
			}
		},
		/**
		 * Register events for three fields
		 */
		registerEventsForThreeFields: function () {
			this.registerSaveDependentPicklist();
			this.registerChangeSourceValue();
		},
		/**
		 * register events for picklist dependency
		 */
		registerEvents: function () {
			var thisInstance = this;
			this.container = jQuery('.js-picklist-dependent-container');
			this.form = jQuery('#pickListDependencyForm');
			if (this.form.length > 0) {
				if (this.form.find('.editDependency').val() == 'true') {
					this.form
						.find(
							'select[name="sourceModule"],select[name="sourceField"],select[name="secondField"],select[name="thirdField"]'
						)
						.prop('disabled', true);
					thisInstance.registerDependencyGraphEvents();
					thisInstance.registerSubmitEvent();
					thisInstance.registerEventsForThreeFields();
				} else {
					thisInstance.registerAddViewEvents();
				}
			} else {
				thisInstance.registerListViewEvents();
			}
		}
	}
);

jQuery(document).ready(function () {
	var instance = new Settings_PickListDependency_Js();
	instance.registerEvents();
});
