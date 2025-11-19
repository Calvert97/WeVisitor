/**
 * Notes: 管理员管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2021-07-11 07:48:00 
 */

const BaseProjectAdminService = require('./base_project_admin_service.js');
const util = require('../../../../framework/utils/util.js');
const dataUtil = require('../../../../framework/utils/data_util.js');
const timeUtil = require('../../../../framework/utils/time_util.js');
const AdminModel = require('../../model/admin_model.js');
const LogModel = require('../../../../framework/platform/model/log_model.js');
const md5Lib = require('../../../../framework/lib/md5_lib.js');

class AdminMgrService extends BaseProjectAdminService {

	//**管理员登录  */
	async adminLogin(name, password, openId) {

		// 判断是否存在
		let where = {
			ADMIN_STATUS: 1,
			ADMIN_NAME: name,
			ADMIN_PASSWORD: md5Lib.md5(password)
		}
		let fields = 'ADMIN_DEPT,ADMIN_ID,ADMIN_NAME,ADMIN_DESC,ADMIN_TYPE,ADMIN_LOGIN_TIME,ADMIN_LOGIN_CNT';
		let admin = await AdminModel.getOne(where, fields);
		if (!admin)
			this.AppError('管理员不存在或者已停用');

		let cnt = admin.ADMIN_LOGIN_CNT;

		// 生成token
		let token = dataUtil.genRandomString(32);
		let tokenTime = timeUtil.time();
		let data = {
			ADMIN_TOKEN: token,
			ADMIN_TOKEN_TIME: tokenTime,
			ADMIN_LOGIN_TIME: timeUtil.time(),
			ADMIN_LOGIN_CNT: cnt + 1
		}
		await AdminModel.edit(where, data);

		let type = admin.ADMIN_TYPE;
		let last = (!admin.ADMIN_LOGIN_TIME) ? '尚未登录' : timeUtil.timestamp2Time(admin.ADMIN_LOGIN_TIME);

		// 写日志
		this.insertLog('登录了系统', admin, LogModel.TYPE.SYS);

		return {
			token,
			name: admin.ADMIN_NAME,
			type,
			last,
			cnt,
			dept: admin.ADMIN_DEPT
		}

	}

	async clearLog() {
		let where = {}
		await LogModel.del(where);
	}

	/** 取得日志分页列表 */
	async getLogList({
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
			LOG_ADD_TIME: 'desc'
		};
		let fields = '*';
		let where = {};

		if (util.isDefined(search) && search) {
			where.or = [{
				LOG_CONTENT: ['like', search]
			}, {
				LOG_ADMIN_DESC: ['like', search]
			}, {
				LOG_ADMIN_NAME: ['like', search]
			}];

		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'type':
					// 按类型
					where.LOG_TYPE = Number(sortVal);
					break;
			}
		}
		let result = await LogModel.getList(where, fields, orderBy, page, size, true, oldTotal);


		return result;
	}

	/** 获取所有管理员 */
	async getMgrList({
		search, // 搜索条件
		sortType, // 搜索菜单
		sortVal, // 搜索菜单
		orderBy, // 排序
		whereEx, //附加查询条件
		page,
		size,
		isTotal = true,
		oldTotal
	}) {
		orderBy = {
			ADMIN_ADD_TIME: 'desc'
		}
		let fields = 'ADMIN_DEPT,ADMIN_NAME,ADMIN_STATUS,ADMIN_PHONE,ADMIN_TYPE,ADMIN_LOGIN_CNT,ADMIN_LOGIN_TIME,ADMIN_DESC,ADMIN_EDIT_TIME,ADMIN_EDIT_IP';

		let where = {};
		where.and = {
			_pid: this.getProjectId() //复杂的查询在此处标注PID
		};
		if (util.isDefined(search) && search) {
			where.or = [{
				ADMIN_NAME: ['like', search]
			},
			{
				ADMIN_PHONE: ['like', search]
			},
			{
				ADMIN_DESC: ['like', search]
			}
			];
		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'status':
					// 按类型
					where.and.ADMIN_STATUS = Number(sortVal);
					break;
				case 'type':
					// 按类型
					where.and.ADMIN_TYPE = Number(sortVal);
					break;
			}
		}

		return await AdminModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}

	/** 删除管理员 */
	async delMgr(id, myAdminId) {
		let mgr = await AdminModel.getOne(id, 'ADMIN_NAME,ADMIN_DESC,ADMIN_TYPE');
		if (!mgr)
			this.AppError('管理员不存在');
		if (mgr._id == myAdminId)
			this.AppError('不能删除当前登录账号');
		if (mgr.ADMIN_TYPE == 1)
			this.AppError('不能删除超级管理员');

		await AdminModel.del(id);
	}

	/** 添加新的管理员 */
	async insertMgr({
		name,
		type,
		desc,
		phone,
		password,
		dept
	}) {
		let cnt = await AdminModel.count({ ADMIN_NAME: name });
		if (cnt > 0)
			this.AppError('该账号已存在');

		let data = {
			ADMIN_NAME: name,
			ADMIN_TYPE: Number(type),
			ADMIN_DESC: desc,
			ADMIN_PHONE: phone || '',
			ADMIN_PASSWORD: md5Lib.md5(password),
			ADMIN_DEPT: Array.isArray(dept) ? dept : []
		};

		let id = await AdminModel.insert(data);
		return { id };
	}

	/** 修改状态 */
	async statusMgr(id, status, myAdminId) {
		let mgr = await AdminModel.getOne(id, 'ADMIN_STATUS,ADMIN_TYPE,ADMIN_NAME');
		if (!mgr)
			this.AppError('管理员不存在');
		if (mgr.ADMIN_TYPE == 1 && status == 0)
			this.AppError('不能禁用超级管理员');

		let data = {
			ADMIN_STATUS: status
		};
		if (status == 0) {
			data.ADMIN_TOKEN = '';
			data.ADMIN_TOKEN_TIME = 0;
		}
		await AdminModel.edit(id, data);
	}

	/** 修改管理员 */
	async editMgr(id, {
		name,
		type,
		desc,
		phone,
		password,
		dept
	}) {
		let mgr = await AdminModel.getOne(id, 'ADMIN_NAME,ADMIN_TYPE');
		if (!mgr)
			this.AppError('管理员不存在');
		if (mgr.ADMIN_TYPE == 1 && Number(type) != 1)
			this.AppError('不能修改超级管理员类型');

		let whereName = {
			ADMIN_NAME: name,
			_id: ['<>', id]
		};
		let cnt = await AdminModel.count(whereName);
		if (cnt > 0)
			this.AppError('该账号已存在');

		let data = {
			ADMIN_NAME: name,
			ADMIN_TYPE: Number(type),
			ADMIN_DESC: desc,
			ADMIN_PHONE: phone || '',
			ADMIN_DEPT: Array.isArray(dept) ? dept : []
		};
		if (password)
			data.ADMIN_PASSWORD = md5Lib.md5(password);

		await AdminModel.edit(id, data);
	}

	/** 修改自身密码 */
	async pwdtMgr(adminId, oldPassword, password) {
		let admin = await AdminModel.getOne(adminId, 'ADMIN_PASSWORD,ADMIN_NAME');
		if (!admin)
			this.AppError('管理员不存在');
		if (admin.ADMIN_PASSWORD != md5Lib.md5(oldPassword))
			this.AppError('旧密码不正确');

		await AdminModel.edit(adminId, { ADMIN_PASSWORD: md5Lib.md5(password) });
	}

	/** 获取管理员信息 */
	async getMgrDetail(id) {
		let fields = '*';

		let where = {
			_id: id
		};
		let mgr = await AdminModel.getOne(where, fields);
		if (!mgr) return null;

		return mgr;
	}
}

module.exports = AdminMgrService;
