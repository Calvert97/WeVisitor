/**
 * Notes: 资讯后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2021-07-11 07:48:00 
 */

const BaseProjectAdminService = require('./base_project_admin_service.js');
const AdminHomeService = require('../admin/admin_home_service.js');
const dataUtil = require('../../../../framework/utils/data_util.js');
const util = require('../../../../framework/utils/util.js');
const timeUtil = require('../../../../framework/utils/time_util.js');
const cloudUtil = require('../../../../framework/cloud/cloud_util.js');

const NewsModel = require('../../model/news_model.js');

class AdminNewsService extends BaseProjectAdminService {

	/** 推荐首页SETUP */
	async vouchNewsSetup(id, vouch) {
		let homeService = new AdminHomeService();
		if (vouch == 1) {
			let news = await NewsModel.getOne(id, 'NEWS_TITLE,NEWS_DESC,NEWS_PIC');
			if (!news) return;
			let node = {
				id,
				title: news.NEWS_TITLE,
				desc: news.NEWS_DESC,
				cover: (news.NEWS_PIC && news.NEWS_PIC[0]) ? news.NEWS_PIC[0] : '',
				url: `/projects/visit/pages/news/detail/news_detail?id=${id}`,
				type: 'news'
			};
			await homeService.updateHomeVouch(node);
		} else {
			await homeService.delHomeVouch(id);
		}
	}

	/**添加资讯 */
	async insertNews({
		title,
		cateId, //分类
		cateName,
		order,
		desc = '',
		forms
	}) {
		let data = {
			NEWS_TITLE: title,
			NEWS_CATE_ID: cateId,
			NEWS_CATE_NAME: cateName,
			NEWS_ORDER: Number(order),
			NEWS_DESC: desc,
			NEWS_FORMS: forms,
			NEWS_OBJ: dataUtil.dbForms2Obj(forms)
		};

		let id = await NewsModel.insert(data);
		return { id };
	}

	/**删除资讯数据 */
	async delNews(id) {
		let news = await NewsModel.getOne(id, 'NEWS_PIC,NEWS_CONTENT,NEWS_FORMS');
		if (!news)
			this.AppError('记录不存在');

		await NewsModel.del(id);
		await this.vouchNewsSetup(id, 0);
		await cloudUtil.handlerCloudFiles(news.NEWS_PIC || [], []);
		await cloudUtil.handlerCloudFilesByRichEditor(news.NEWS_CONTENT || [], []);
		await cloudUtil.handlerCloudFilesForForms(news.NEWS_FORMS || [], []);
	}

	// 更新forms信息
	async updateNewsForms({
		id,
		hasImageForms
	}) {
		if (!hasImageForms || hasImageForms.length == 0) return [];
		let oldForms = await NewsModel.getOneField(id, 'NEWS_FORMS');
		await NewsModel.editForms(id, 'NEWS_FORMS', 'NEWS_OBJ', hasImageForms);
		let newForms = await NewsModel.getOneField(id, 'NEWS_FORMS');
		await cloudUtil.handlerCloudFilesForForms(oldForms || [], newForms || []);
		return newForms;
	}

	/**
	 * 更新富文本详细的内容及图片信息
	 * @returns 返回 urls数组 [url1, url2, url3, ...]
	 */
	async updateNewsContent({
		id,
		content // 富文本数组
	}) {
		let news = await NewsModel.getOne(id, 'NEWS_CONTENT');
		if (!news)
			this.AppError('记录不存在');

		await NewsModel.edit(id, { NEWS_CONTENT: content });
		await cloudUtil.handlerCloudFilesByRichEditor(news.NEWS_CONTENT || [], content || []);
		return content;
	}

	/**
	 * 更新资讯图片信息
	 * @returns 返回 urls数组 [url1, url2, url3, ...]
	 */
	async updateNewsPic({
		id,
		imgList // 图片数组
	}) {
		let news = await NewsModel.getOne(id, 'NEWS_PIC');
		if (!news)
			this.AppError('记录不存在');

		await cloudUtil.handlerCloudFiles(news.NEWS_PIC || [], imgList || []);
		await NewsModel.edit(id, { NEWS_PIC: imgList });
		return { urls: imgList };
	}

	/**更新资讯数据 */
	async editNews({
		id,
		title,
		cateId, //分类
		cateName,
		order,
		desc = '',
		forms
	}) {
		let news = await NewsModel.getOne(id, '_id');
		if (!news)
			this.AppError('记录不存在');

		let data = {
			NEWS_TITLE: title,
			NEWS_CATE_ID: cateId,
			NEWS_CATE_NAME: cateName,
			NEWS_ORDER: Number(order),
			NEWS_DESC: desc,
			NEWS_FORMS: forms,
			NEWS_OBJ: dataUtil.dbForms2Obj(forms)
		};
		await NewsModel.edit(id, data);
	}

	/**修改资讯状态 */
	async statusNews(id, status) {
		await NewsModel.edit(id, { NEWS_STATUS: Number(status) });
	}

	/**置顶与排序设定 */
	async sortNews(id, sort) {
		await NewsModel.edit(id, { NEWS_ORDER: Number(sort) });
	}

	/**首页设定 */
	async vouchNews(id, vouch) {
		await NewsModel.edit(id, { NEWS_VOUCH: Number(vouch) });
		await this.vouchNewsSetup(id, vouch);
	}
	/**获取资讯信息 */
	async getNewsDetail(id) {
		let fields = '*';

		let where = {
			_id: id
		}
		let news = await NewsModel.getOne(where, fields);
		if (!news) return null;

		return news;
	}


	/**取得资讯分页列表 */
	async getAdminNewsList({
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

		orderBy = orderBy || {
			'NEWS_ORDER': 'asc',
			'NEWS_ADD_TIME': 'desc'
		};
		let fields = 'NEWS_TITLE,NEWS_DESC,NEWS_CATE_ID,NEWS_CATE_NAME,NEWS_EDIT_TIME,NEWS_ADD_TIME,NEWS_ORDER,NEWS_STATUS,NEWS_CATE2_NAME,NEWS_VOUCH,NEWS_QR,NEWS_OBJ';

		let where = {};
		where.and = {
			_pid: this.getProjectId() //复杂的查询在此处标注PID
		};

		if (util.isDefined(search) && search) {
			where.or = [
				{ NEWS_TITLE: ['like', search] },
			];

		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'cateId': {
					where.and.NEWS_CATE_ID = String(sortVal);
					break;
				}
				case 'status': {
					where.and.NEWS_STATUS = Number(sortVal);
					break;
				}
				case 'vouch': {
					where.and.NEWS_VOUCH = 1;
					break;
				}
				case 'top': {
					where.and.NEWS_ORDER = 0;
					break;
				}
				case 'sort': {
					orderBy = this.fmtOrderBySort(sortVal, 'NEWS_ADD_TIME');
					break;
				}

			}
		}

		return await NewsModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}
}

module.exports = AdminNewsService;
