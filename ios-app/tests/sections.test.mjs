import test from 'node:test';import assert from 'node:assert/strict';
import {homeSections,sectionRoute,sectionItems,collectionGroups} from '../Web/model.mjs';
test('section links preserve allowlisted topic, category and timeline IDs',()=>{
 assert.equal(sectionRoute('specialTopic/vods?specialTopicId=12&title=Movies').kind,'topic');
 assert.equal(sectionRoute('specialTopic/categoryTopics?topicCategoryId=35').id,'35');
 assert.equal(sectionRoute('vod/timeline?timelineId=33').kind,'timeline');
 for(const url of ['https://evil.test/specialTopic/vods?specialTopicId=12','//evil.test/a','browser?url=x','specialTopic/vods?specialTopicId=../bad'])assert.equal(sectionRoute(url),null);
});
test('home sections retain real more links and topical cards, but exclude advertisements',()=>{
 const data={blocks:[{header:{title:'热门',url:'specialTopic/vods?specialTopicId=12'},data:[{title:'电影',url:'vod/detail?vodId=1'}]},{header:{title:'合集',url:'specialTopic/categoryTopics?topicCategoryId=1'},data:[{title:'合集一',url:'specialTopic/vods?specialTopicId=87'}]},{_vod:'ad_home',data:[{title:'广告',url:'vod/detail?vodId=2'}]}]};
 const sections=homeSections(data);assert.equal(sections.length,2);assert.equal(sections[0].route.id,'12');assert.equal(sections[1].items[0].route.id,'87');
});
test('collection groups keep headings and nested routes without flattening timeline structure or ad blocks',()=>{
 const groups=collectionGroups({items:[{_vod:'topic',header:{title:'漫威',url:'vod/timeline?timelineId=33'},data:[{title:'电影',url:'vod/detail?vodId=1'}]},{_vod:'ad_topic',data:[{title:'广告',url:'vod/detail?vodId=2'}]}]});
 assert.equal(groups.length,1);assert.equal(groups[0].title,'漫威');assert.equal(groups[0].route.kind,'timeline');assert.equal(groups[0].items.length,1);
 assert.equal(sectionItems([{title:'成人',channelId:5,url:'vod/detail?vodId=3'}]).length,0);
});
