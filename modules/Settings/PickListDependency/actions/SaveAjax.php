<?php
/* +**********************************************************************************
 * The contents of this file are subject to the vtiger CRM Public License Version 1.1
 * ("License"); You may not use this file except in compliance with the License
 * The Original Code is:  vtiger CRM Open Source
 * The Initial Developer of the Original Code is vtiger.
 * Portions created by vtiger are Copyright (C) vtiger.
 * All Rights Reserved.
 * Contributor(s): YetiForce S.A.
 * ********************************************************************************** */

class Settings_PickListDependency_SaveAjax_Action extends Settings_Vtiger_Index_Action
{
	/**
	 * Process method.
	 *
	 * @param App\Request $request
	 *
	 * @return void
	 */
	public function process(App\Request $request)
	{
		$sourceModule = $request->getByType('sourceModule', \App\Purifier::ALNUM);
		$sourceField = $request->getByType('sourceField', \App\Purifier::ALNUM);
		$secondField = $request->getByType('secondField', \App\Purifier::ALNUM);
		$thirdField = $request->isEmpty('thirdField') ? '' : $request->getByType('thirdField', \App\Purifier::ALNUM);
		$recordModel = Settings_PickListDependency_Record_Model::getCleanInstance();
		$recordModel->set('sourceModule', $sourceModule)
			->set('sourceField', $sourceField)
			->set('secondField', $secondField)
			->set('thirdField', $thirdField);

		$response = new Vtiger_Response();
		if ($thirdField) {
			$recordModel->set('picklistDependencies', $request->getArray('mapping'));
		} else {
			$recordModel->set('picklistDependencies', $request->getMultiDimensionArray('mapping',
			[[
				'sourcevalue' => 'Text',
				'targetvalues' => 'Text'
			]]));
		}

		try {
			$result = $recordModel->save();
			$response->setResult(['success' => $result]);
		} catch (Exception $e) {
			$response->setError($e->getCode(), $e->getMessage());
		}
		$response->emit();
	}
}
