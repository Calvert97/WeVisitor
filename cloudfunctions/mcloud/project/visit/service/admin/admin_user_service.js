/**
 * Notes: 用户管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2022-01-22  07:48:00 
 */

const BaseProjectAdminService = require('./base_project_admin_service.js');

const util = require('../../../../framework/utils/util.js');
const exportUtil = require('../../../../framework/utils/export_util.js');
const timeUtil = require('../../../../framework/utils/time_util.js');
const dataUtil = require('../../../../framework/utils/data_util.js');
const cloudUtil = require('../../../../framework/cloud/cloud_util.js');
const UserModel = require('../../model/user_model.js');

// 导出用户数据KEY
const EXPORT_USER_DATA_KEY = 'EXPORT_USER_DATA';

class AdminUserService extends BaseProjectAdminService {



	/** 获得某个用户信息 */
	async getUser({
		userId,
		fields = '*'
	}) {
		let where = {
			USER_MINI_OPENID: userId,
		}
		return await UserModel.getOne(where, fields);
	}

	/** 取得用户分页列表 */
	async getUserList({
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
			USER_ADD_TIME: 'desc'
		};
		let fields = '*';


		let where = {};
		where.and = {
			_pid: this.getProjectId() //复杂的查询在此处标注PID
		};

		if (util.isDefined(search) && search) {
			where.or = [{
				USER_NAME: ['like', search]
			},
			{
				USER_MOBILE: ['like', search]
			},
			{
				USER_MEMO: ['like', search]
			},
			];

		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'status':
					where.and.USER_STATUS = Number(sortVal);
					break;
				case 'sort': {
					orderBy = this.fmtOrderBySort(sortVal, 'USER_ADD_TIME');
					break;
				}
			}
		}
		let result = await UserModel.getList(where, fields, orderBy, page, size, true, oldTotal, false);


		// 为导出增加一个参数condition
		result.condition = encodeURIComponent(JSON.stringify(where));

		return result;
	}

	async statusUser(id, status, reason) {
		let where = { USER_MINI_OPENID: id };
		let user = await UserModel.getOne(where, 'USER_STATUS');
		if (!user)
			this.AppError('用户不存在');
		status = Number(status);
		let data = {
			USER_STATUS: status
		};
		if (status == UserModel.STATUS.UNCHECK)
			data.USER_CHECK_REASON = reason || '';
		else if (status == UserModel.STATUS.FORBID)
			data.USER_CHECK_REASON = reason || '';
		else
			data.USER_CHECK_REASON = '';
		await UserModel.edit(where, data);
	}

	/**删除用户 */
	async delUser(id) {
		let where = { USER_MINI_OPENID: id };
		let user = await UserModel.getOne(where, 'USER_FORMS');
		if (!user)
			this.AppError('用户不存在');
		await UserModel.del(where);
		await cloudUtil.handlerCloudFilesForForms(user.USER_FORMS || [], []);

	}

	// #####################导出用户数据

	/**获取用户数据 */
	async getUserDataURL() {
		return await exportUtil.getExportDataURL(EXPORT_USER_DATA_KEY);
	}

	/**删除用户数据 */
	async deleteUserDataExcel() {
		return await exportUtil.deleteDataExcel(EXPORT_USER_DATA_KEY);
	}

	/**导出用户数据 */
	async exportUserDataExcel(condition, fields) {

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

		let orderBy = { USER_ADD_TIME: 'desc' };
		let list = await UserModel.getAllBig(where, 'USER_NAME,USER_MOBILE,USER_STATUS,USER_ADD_TIME,USER_LOGIN_TIME,USER_FORMS', orderBy);

		if (!Array.isArray(fields)) fields = [];
		let fieldMarks = [];
		let header = ['用户昵称', '联系电话'];
		for (let item of fields) {
			if (!item || !item.mark) continue;
			fieldMarks.push(item.mark);
			header.push(item.title || item.mark);
		}
		header.push('状态');
		header.push('注册时间');
		header.push('最近登录时间');

		let data = [header];
		for (let item of list) {
			let row = [];
			row.push(item.USER_NAME || '');
			row.push(item.USER_MOBILE || '');
			for (let mark of fieldMarks) {
				row.push(this._getFormValue(item.USER_FORMS || [], mark));
			}
			row.push(UserModel.getDesc('STATUS', item.USER_STATUS));
			row.push(timeUtil.timestamp2Time(item.USER_ADD_TIME, 'Y-M-D h:m'));
			row.push(item.USER_LOGIN_TIME ? timeUtil.timestamp2Time(item.USER_LOGIN_TIME, 'Y-M-D h:m') : '未登录');
			data.push(row);
		}

		let options = {
			'!cols': header.map(() => ({ wch: 20 }))
		};

		return await exportUtil.exportDataExcel(EXPORT_USER_DATA_KEY, '用户数据', list.length, data, options);

	}

}

AdminUserService.prototype._getFormValue = function (forms, mark) {
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

module.exports = AdminUserService;
