/**
 * Notes: 报修管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2022-08-22  07:48:00 
 */

const BaseProjectAdminService = require('./base_project_admin_service.js');

const util = require('../../../../framework/utils/util.js');
const exportUtil = require('../../../../framework/utils/export_util.js');
const timeUtil = require('../../../../framework/utils/time_util.js');
const TaskModel = require('../../model/task_model.js');
const MsgService = require('../msg_service.js');

// 导出数据KEY
const EXPORT_TASK_DATA_KEY = 'EXPORT_TASK_DATA';

class AdminTaskService extends BaseProjectAdminService {

	/** 管理员扫码核验 */
	async scanTask(admin, taskId) {
		let task = await TaskModel.getOne(taskId, 'TASK_STATUS,TASK_OBJ,TASK_OVER_ADMIN_NAME,TASK_OVER_TIME');
		if (!task)
			this.AppError('通行码不存在');

		let person = (task.TASK_OBJ && task.TASK_OBJ.person) ? task.TASK_OBJ.person : '访客';
		let tips = '';
		if (task.TASK_STATUS == TaskModel.STATUS.WAIT) {
			tips = `【${person}】的申请尚未审批，无法通行`;
			return tips;
		}
		if (task.TASK_STATUS == TaskModel.STATUS.FAIL) {
			tips = `【${person}】的申请未通过审批，无法通行`;
			return tips;
		}
		if (task.TASK_STATUS == TaskModel.STATUS.OVER) {
			let overTime = task.TASK_OVER_TIME ? timeUtil.timestamp2Time(task.TASK_OVER_TIME, 'Y-M-D h:m') : '';
			return `【${person}】已于${overTime}完成来访核验`;
		}

		let data = {
			TASK_STATUS: TaskModel.STATUS.OVER,
			TASK_OVER_ADMIN_ID: admin._id,
			TASK_OVER_ADMIN_NAME: admin.ADMIN_NAME,
			TASK_OVER_TIME: this._timestamp
		};
		await TaskModel.edit(taskId, data);
		return `【${person}】核验成功，状态已更新为「已来访」`;
	}

	async getAdminTaskDetail(id) {
		let where = {
			_id: id
		};
		return await TaskModel.getOne(where);
	}

	/** 取得分页列表 */
	async getAdminTaskList(admin, {
		search, // 搜索条件
		sortType, // 搜索菜单
		sortVal, // 搜索菜单
		orderBy, // 排序
		whereEx, //附加查询条件 
		page,
		size,
		oldTotal = 0
	}) {

		orderBy = orderBy || {
			TASK_ADD_TIME: 'desc'
		};
		let fields = 'TASK_SUCC_TIME,TASK_ADMIN_NAME,TASK_TYPE,TASK_STATUS,TASK_OBJ,TASK_ADD_TIME';


		let where = {};
		where.and = {
			_pid: this.getProjectId(), //复杂的查询在此处标注PID  
		};

		if (admin.ADMIN_TYPE == 2) {
			where.and['TASK_OBJ.dept'] = ['in', admin.ADMIN_DEPT];
		}

		if (util.isDefined(search) && search && search.includes('#')) {
			let arr = search.split('#');
			where.and['TASK_OBJ.date'] = ['between', arr[0], arr[1]];
		}
		else if (util.isDefined(search) && search) {
			where.or = [
				{ ['TASK_OBJ.title']: ['like', search] },
				{ ['TASK_OBJ.person']: ['like', search] },
				{ ['TASK_OBJ.phone']: ['like', search] },
				{ ['TASK_OBJ.building']: ['like', search] },
			];

		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'month': {
					if (sortVal == 99) break;
					let start = sortVal;
					let end = timeUtil.getLastOfMonth(start)
					// console.log(start, end);

					start = timeUtil.time2Timestamp(start + '-01');
					end = timeUtil.time2Timestamp(end);
					//console.log(start, end);

					where.and['TASK_ADD_TIME'] = ['between', start, end];
					where.and['TASK_STATUS'] = 9;
					break;
				}
				case 'dept': {
					where.and['TASK_OBJ.dept'] = sortVal;
					break;
				}
				case 'type': {
					where.and['TASK_OBJ.type'] = sortVal;
					break;
				}
				case 'typex': {
					where.and['TASK_TYPE'] = Number(sortVal);
					break;
				}
				case 'status': {
					sortVal = Number(sortVal);
					if (sortVal == 99) break;
					where.and['TASK_STATUS'] = sortVal;
					break;
				}
				case 'sort': {
					orderBy = this.fmtOrderBySort(sortVal, 'TASK_ADD_TIME');
					break;
				}
			}
		}

		let result = await TaskModel.getList(where, fields, orderBy, page, size, true, oldTotal, false);


		// 为导出增加一个参数condition
		result.condition = encodeURIComponent(JSON.stringify(where));

		return result;
	}

	/**修改状态 */
	async statusAdminTask(admin, id, status) {
		status = Number(status);
		if (![TaskModel.STATUS.WAIT, TaskModel.STATUS.SUCC, TaskModel.STATUS.FAIL, TaskModel.STATUS.OVER].includes(status))
			this.AppError('状态错误');

		let task = await TaskModel.getOne(id, 'TASK_STATUS,TASK_FORMS,TASK_OBJ,TASK_USER_ID');
		if (!task)
			this.AppError('记录不存在');

		let data = {
			TASK_STATUS: status
		};
		switch (status) {
			case TaskModel.STATUS.WAIT:
				data = {
					...data,
					TASK_SUCC_ADMIN_ID: '',
					TASK_SUCC_ADMIN_NAME: '',
					TASK_SUCC_TIME: 0,
					TASK_FAIL_ADMIN_ID: '',
					TASK_FAIL_ADMIN_NAME: '',
					TASK_FAIL_TIME: 0,
					TASK_OVER_ADMIN_ID: '',
					TASK_OVER_ADMIN_NAME: '',
					TASK_OVER_TIME: 0
				};
				break;
			case TaskModel.STATUS.SUCC:
				data = {
					...data,
					TASK_SUCC_ADMIN_ID: admin._id,
					TASK_SUCC_ADMIN_NAME: admin.ADMIN_NAME,
					TASK_SUCC_TIME: this._timestamp,
					TASK_FAIL_ADMIN_ID: '',
					TASK_FAIL_ADMIN_NAME: '',
					TASK_FAIL_TIME: 0
				};
				break;
			case TaskModel.STATUS.FAIL:
				data = {
					...data,
					TASK_FAIL_ADMIN_ID: admin._id,
					TASK_FAIL_ADMIN_NAME: admin.ADMIN_NAME,
					TASK_FAIL_TIME: this._timestamp
				};
				break;
			case TaskModel.STATUS.OVER:
				data = {
					...data,
					TASK_OVER_ADMIN_ID: admin._id,
					TASK_OVER_ADMIN_NAME: admin.ADMIN_NAME,
					TASK_OVER_TIME: this._timestamp
				};
				break;
		}

		await TaskModel.edit(id, data);

		if (task.TASK_USER_ID && (status == TaskModel.STATUS.SUCC || status == TaskModel.STATUS.FAIL)) {
			let msgService = new MsgService();
			let result = (status == TaskModel.STATUS.SUCC) ? '审批通过' : '审批未通过';
			let dateStr = '';
			if (task.TASK_OBJ) {
				let date = task.TASK_OBJ.date || '';
				let hour = task.TASK_OBJ.hour || '';
				dateStr = (date + ' ' + hour).trim();
			}
			await msgService.apptResult(task.TASK_USER_ID, id, task.TASK_OBJ.person || '', task.TASK_OBJ.desc || '', dateStr, result);
		}

		return { id, status };
	}

	// #####################导出数据
	/**获取数据 */
	async getTaskDataURL() {
		return await exportUtil.getExportDataURL(EXPORT_TASK_DATA_KEY);
	}

	/**删除数据 */
	async deleteTaskDataExcel() {
		return await exportUtil.deleteDataExcel(EXPORT_TASK_DATA_KEY);
	}

	/**导出数据 */
	async exportTaskDataExcel(condition, fields) {

		let where = {};
		if (condition) {
			try {
				where = JSON.parse(decodeURIComponent(condition));
			} catch (err) {
				where = {};
			}
		}
		if (!where || Object.keys(where).length == 0) {
			where = {
				and: {
					_pid: this.getProjectId()
				}
			};
		}

		let orderBy = { TASK_ADD_TIME: 'desc' };
		let list = await TaskModel.getAllBig(where, 'TASK_FORMS,TASK_STATUS,TASK_ADD_TIME,TASK_OBJ,TASK_SUCC_ADMIN_NAME,TASK_SUCC_TIME,TASK_FAIL_ADMIN_NAME,TASK_FAIL_TIME,TASK_OVER_ADMIN_NAME,TASK_OVER_TIME', orderBy);

		if (!Array.isArray(fields)) fields = [];
		let fieldMarks = [];
		let header = [];
		for (let item of fields) {
			if (!item || !item.mark) continue;
			fieldMarks.push(item.mark);
			header.push(item.title || item.mark);
		}
		header.push('审批状态');
		header.push('提交时间');
		header.push('审批人');
		header.push('审批时间');
		header.push('核验人');
		header.push('核验时间');

		let data = [header];
		for (let item of list) {
			let row = [];
			for (let mark of fieldMarks) {
				row.push(this._getFormValue(item.TASK_FORMS || [], mark));
			}
			row.push(TaskModel.getDesc('STATUS', item.TASK_STATUS));
			row.push(timeUtil.timestamp2Time(item.TASK_ADD_TIME, 'Y-M-D h:m'));
			let approveName = item.TASK_STATUS == TaskModel.STATUS.FAIL ? item.TASK_FAIL_ADMIN_NAME : item.TASK_SUCC_ADMIN_NAME;
			let approveTime = item.TASK_STATUS == TaskModel.STATUS.FAIL ? item.TASK_FAIL_TIME : item.TASK_SUCC_TIME;
			row.push(approveName || '');
			row.push(approveTime ? timeUtil.timestamp2Time(approveTime, 'Y-M-D h:m') : '');
			row.push(item.TASK_OVER_ADMIN_NAME || '');
			row.push(item.TASK_OVER_TIME ? timeUtil.timestamp2Time(item.TASK_OVER_TIME, 'Y-M-D h:m') : '');
			data.push(row);
		}

		let options = {
			'!cols': header.map(() => ({ wch: 20 }))
		};

		return await exportUtil.exportDataExcel(EXPORT_TASK_DATA_KEY, '来访申请', list.length, data, options);
	}

}

AdminTaskService.prototype._getFormValue = function (forms, mark) {
	if (!forms) return '';
	for (let item of forms) {
		if (item.mark == mark) {
			if (item.type == 'image') return '[图片]';
			if (item.type == 'content') return '[图文内容]';
			if (item.type == 'switch') return item.val === true ? '是' : '否';
			return item.val === undefined || item.val === null ? '' : item.val;
		}
	}
	return '';
};

module.exports = AdminTaskService;
