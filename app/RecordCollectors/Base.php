<?php
/**
 * Base record collector file.
 *
 * @package App
 *
 * @copyright YetiForce S.A.
 * @license   YetiForce Public License 5.0 (licenses/LicenseEN.txt or yetiforce.com)
 * @author    Mariusz Krzaczkowski <m.krzaczkowski@yetiforce.com>
 * @author    Radosław Skrzypczak <r.skrzypczak@yetiforce.com>
 */

namespace App\RecordCollectors;

/**
 * Base record collector class.
 */
class Base
{
	/** @var string Module name. */
	public $moduleName;

	/** @var string[] Allowed modules. */
	protected static $allowedModules = [];

	/** @var string Icon. */
	public $icon;

	/** @var string Label. */
	public $label;

	/** @var string Additional description, visible in the modal window. */
	public $description;

	/** @var string Search results display type. */
	public $displayType;

	/** var array List of fields for the modal search window. */
	protected $fields = [];

	/** @var \App\Request Request instance. */
	protected $request;
	/**
	 * Fields mapping for loading record data.
	 *
	 * @var array
	 */
	protected $modulesFieldsMap = [];

	/**
	 * Constructor.
	 */
	public function __construct()
	{
		$class = last(explode('\\', static::class));
		$config = \App\Config::component('RecordCollectors' . $class);
		if (null === $config) {
			return;
		}
		if (isset($config['allowedModules'])) {
			static::$allowedModules = $config['allowedModules'];
			unset($config['allowedModules']);
		}
		foreach ($config as $key => $value) {
			$this->{$key} = $value;
		}
	}

	/**
	 * Set request.
	 *
	 * @param \App\Request $request
	 *
	 * @return void
	 */
	public function setRequest(\App\Request $request): void
	{
		$this->request = $request;
	}

	/**
	 * Get fields for the modal search window.
	 *
	 * @return \Vtiger_Field_Model[]
	 */
	public function getFields(): array
	{
		$fields = [];
		foreach ($this->fields as $fieldName => $data) {
			if (isset($data['picklistValues']) && false !== $data['picklistModule']) {
				$picklistModule = $data['picklistModule'] ?? $this->moduleName;
				foreach ($data['picklistValues'] as $picklistKey => $value) {
					$data['picklistValues'][$picklistKey] = \App\Language::translate($value, $picklistModule);
				}
			}
			$fieldModel = \Vtiger_Field_Model::init($this->moduleName, $data, $fieldName);
			if (isset($this->modulesFieldsMap[$this->moduleName][$fieldName]) && $this->request->has($this->modulesFieldsMap[$this->moduleName][$fieldName])) {
				try {
					$uitypeModel = $fieldModel->getUITypeModel();
					$value = $this->request->getByType($this->modulesFieldsMap[$this->moduleName][$fieldName], 'Text');
					$uitypeModel->validate($value, true);
					$fieldModel->set('fieldvalue', $uitypeModel->getDBValue($value));
				} catch (\Throwable $th) {
					\App\Log::error($th->__toString(), 'RecordCollectors');
				}
			}
			$fields[$fieldName] = $fieldModel;
		}
		return $fields;
	}

	/**
	 * Check whether it is active.
	 *
	 * @return bool
	 */
	public function isActive(): bool
	{
		return \in_array($this->moduleName, static::$allowedModules);
	}

	/**
	 * Search data function.
	 *
	 * @return array
	 */
	public function search(): array
	{
		throw new \Api\Core\Exception('no search function');
	}
}
