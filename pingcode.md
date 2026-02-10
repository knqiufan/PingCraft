## 获取工作项类型列表

GET

```html
https://rest_api_root/v1/project/work_item/types?project_id={project_id}
```

权限: 企业令牌/用户令牌

查询参数

| 字段       | 类型   | 描述       |
| :--------- | :----- | :--------- |
| project_id | String | 项目的id。 |

响应示例（scrum项目）：

```json
{
    "page_size": 30,
    "page_index": 0,
    "total": 6,
    "values": [
        {
            "id": "epic",
            "url": "http://rest_api_root/v1/project/work_item_types/epic",
            "name": "史诗",
            "group": "requirement"
        },
        {
            "id": "feature",
            "url": "http://rest_api_root/v1/project/work_item_types/feature",
            "name": "特性",
            "group": "requirement"
        },
        {
            "id": "story",
            "url": "http://rest_api_root/v1/project/work_item_types/story",
            "name": "用户故事",
            "group": "requirement"
        },
        {
            "id": "task",
            "url": "http://rest_api_root/v1/project/work_item_types/task",
            "name": "任务",
            "group": "task"
        },
        {
            "id": "bug",
            "url": "http://rest_api_root/v1/project/work_item_types/bug",
            "name": "缺陷",
            "group": "bug"
        }
    ]
}
```

## 获取工作项状态列表

GET

```html
https://rest_api_root/v1/project/work_item/states?project_id={project_id}&work_item_type_id={work_item_type_id}
```

权限: 企业令牌/用户令牌

查询参数

| 字段              | 类型   | 描述                                                         |
| :---------------- | :----- | :----------------------------------------------------------- |
| project_id        | String | 项目的id。                                                   |
| work_item_type_id | String | 工作项类型的id。工作项类型分为9种系统类型和一些自定义类型。系统类型包括：史诗、特性、用户故事、阶段、里程碑、需求、任务、缺陷和事务。可以通过`获取全部工作项类型列表`获得。 |

响应示例：

```json
{
    "page_size": 30,
    "page_index": 0,
    "total": 1,
    "values": [
        {
            "id": "5c9b35de90ad7153c2062f18",
            "url": "https://rest_api_root/v1/project/work_item_states/5c9b35de90ad7153c2062f18",
            "name": "新建",
            "type": "pending",
            "color": "#ff7575"
        }
    ]
}
```

## 获取工作项属性列表

GET

```html
https://rest_api_root/v1/project/work_item/properties?project_id={project_id}&work_item_type_id={work_item_type_id}
```

权限: 企业令牌/用户令牌

查询参数

| 字段              | 类型   | 描述                                                         |
| :---------------- | :----- | :----------------------------------------------------------- |
| project_id        | String | 项目的id。                                                   |
| work_item_type_id | String | 工作项类型的id。工作项类型分为9种系统类型和一些自定义类型。系统类型包括：史诗、特性、用户故事、阶段、里程碑、需求、任务、缺陷和事务。可以通过`获取全部工作项类型列表`获得。 |

响应示例：

```json
{
    "page_size": 30,
    "page_index": 0,
    "total": 1,
    "values": [
        {
            "id": "severity",
            "url": "https://rest_api_root/v1/project/work_item/work_item_properties/severity",
            "name": "严重程度",
            "type": "select",
            "options": [
                {
                    "_id": "5efb1859110533727a82c603",
                    "text": "严重"
                },
                {
                    "_id": "5efb1859110533727a82c604",
                    "text": "一般"
                }
            ]
        },
        {
            "id": "identifier",
            "url": "https://rest_api_root/v1/project/work_item_properties/identifier",
            "name": "编号",
            "type": "text",
            "options": null
        }
    ]
}
```

## 获取工作项优先级列表

GET

```html
https://rest_api_root/v1/project/work_item/priorities?project_id={project_id}
```

权限: 企业令牌/用户令牌

查询参数

| 字段       | 类型   | 描述       |
| :--------- | :----- | :--------- |
| project_id | String | 项目的id。 |

响应示例：

```json
{
    "page_size": 30,
    "page_index": 0,
    "total": 1,
    "values": [
        {
            "id": "5eb623f6a70571487ea47111",
            "url": "https://rest_api_root/v1/project/work_item_priorities/5eb623f6a70571487ea47111",
            "name": "最高"
        }
    ]
}
```

## 获取个人信息

GET

```html
https://rest_api_root/v1/myself
```

权限: 用户令牌

响应示例：

```json
{
    "id": "a0417f68e846aae315c85d24643678a9",
    "url": "https://rest_api_root/v1/directory/users/a0417f68e846aae315c85d24643678a9",
    "name": "john",
    "display_name": "John",
    "avatar": "https://s3.amazonaws.com/bucket/b46ef40c-e22e-4ecf-a599-cace9fba839a_160x160.png",
    "email": "terry@pingcode.com",
    "mobile": "15000000000",
    "status": "enabled",
    "preferences": {
        "locale": "zh-cn",
        "timezone": "Asia/Shanghai"
    },
    "permissions": {
        "agile_create_project": true,
        "agile_configuration": true,
        "create_user": true
    }
}
```

## 创建一个工作项

POST

```html
https://rest_api_root/v1/project/work_items
```

权限: 企业令牌/用户令牌

请求参数

| 字段                   | 类型     | 描述                                                         |
| :--------------------- | :------- | :----------------------------------------------------------- |
| project_id             | String   | 项目的id。                                                   |
| type_id                | String   | 工作项类型的id。工作项类型分为9种系统类型和一些自定义类型。系统类型包括：史诗、特性、用户故事、阶段、里程碑、需求、任务、缺陷和事务。可以通过`获取全部工作项类型列表`获得。 |
| title                  | String   | 工作项的标题。                                               |
| description可选        | String   | 工作项的描述。                                               |
| start_at可选           | Number   | 工作项的开始时间。当工作项类型为里程碑时，该参数无效。       |
| end_at可选             | Number   | 工作项的截止时间。                                           |
| priority_id可选        | String   | 工作项优先级的id。                                           |
| state_id可选           | String   | 工作项状态的id。工作项状态的id在设置时必须同时满足工作项类型的工作项状态方案和工作项状态流转的状态值才能成功完成设置。工作项状态方案可以通过`获取工作项状态方案列表`获取。工作项状态流转则可以通过`获取状态方案中的工作项状态流转列表`获取。 |
| assignee_id可选        | String   | 工作项负责人的id。                                           |
| parent_id可选          | String   | 工作项的父工作项的id。当前工作项类型支持的父工作类型包含`parent_id`对应的工作项类型时，该参数有效。具体配置见属性与视图子工作项配置。 |
| sprint_id可选          | String   | 所属迭代id。该字段只有项目类型为`scrum`和`hybrid`时有效。    |
| version_ids可选        | String[] | 所属发布的id列表。                                           |
| board_id可选           | String   | 看板的id。该字段只有项目类型为`kanban`和`hybrid`时有效。     |
| entry_id可选           | String   | 看板栏的id。该字段只有项目类型为`kanban`和`hybrid`时有效。   |
| swimlane_id可选        | String   | 泳道的id。该字段只有项目类型为`kanban`和`hybrid`时有效。     |
| story_points可选       | Number   | 工作项的故事点。当工作项的属性在视图中配置了故事点属性时，该参数生效。故事点数值必须是大于等于0的整数或最多包含一位小数的正数。 |
| estimated_workload可选 | Number   | 工作项的预估工时。                                           |
| remaining_workload可选 | Number   | 工作项的剩余工时。                                           |
| properties可选         | Object   | 工作项属性的键值对集合，需要注意的是，当前工作项类型对应的工作项属性方案需要包含这些工作项属性，例如工作项属性方案中包含`prop_a`和`prop_b`。 |
| properties.prop_a可选  | Object   | 工作项属性`prop_a`。                                         |
| properties.prop_b可选  | Object   | 工作项属性`prop_b`。                                         |
| participant_ids可选    | String[] | 工作项关注人的id列表。                                       |

请求示例：

```json
{
    "project_id": "5eb623f6a70571487ea47000",
    "type_id": "bug",
    "title": "这是一个缺陷",
    "description": "这是一个缺陷的描述",
    "start_at": 1583290309,
    "end_at": 1583290347,
    "state_id": "5c9b35de90ad7153c2062f18",
    "parent_id": "5edca112b06305c524cad2fa",
    "sprint_id": "5ecf7b74eaab845a2aa53138",
    "version_ids": [
        "5eb623487ea47001f6a70571"
    ],
    "board_id": "5eb623f6a70571487ea47222",
    "entry_id": "5ee1c4fac5b3c51206f0a861",
    "swimlane_id": "5ee1c4fac5b3c51206f0a866",
    "priority_id": "5eb623f6a70571487ea47111",
    "assignee_id": "a0417f68e846aae315c85d24643678a9",
    "participant_ids": [
        "a0417f68e846aae315c85d24643678a9"
    ],
    "story_points": 1,
    "estimated_workload": 1,
    "remaining_workload": 1,
    "properties": {
        "prop_a": "prop_a_value",
        "prop_b": "prop_b_value"
    }
}
```

响应示例：

```json
{
    "id": "5edca524cad2fa1125cb0630",
    "url": "https://rest_api_root/v1/project/work_items/5edca524cad2fa1125cb0630",
    "project": {
        "id": "5eb623f6a70571487ea47000",
        "url": "https://rest_api_root/v1/project/projects/5eb623f6a70571487ea47000",
        "identifier": "SCR",
        "name": "Scrum项目",
        "type": "scrum",
        "is_archived": 0,
        "is_deleted": 0
    },
    "identifier": "SCR-5",
    "title": "这是一个缺陷",
    "type": "bug",
    "start_at": 1583290309,
    "end_at": 1583290347,
    "parent_id": "5edca112b06305c524cad2fa",
    "short_id": "1bAqLmTG",
    "html_url": "https://yctech.pingcode.com/pjm/workitems/1bAqLmTG",
    "parent": {
        "id": "5edca112b06305c524cad2fa",
        "url": "https://rest_api_root/v1/project/work_items/5edca112b06305c524cad2fa",
        "identifier": "SCR-3",
        "title": "这是一个用户故事",
        "type": "story",
        "start_at": 1583290309,
        "end_at": 1583290347,
        "parent_id": "5edca524cad2fa112b06309c",
        "properties": {
            "prop_a": "prop_a_value",
            "prop_b": "prop_b_value",
            "risk": null,
            "business_value": null,
            "effort": null,
            "backlog_type": null,
            "backlog_from": null
        }
    },
    "assignee": {
        "id": "a0417f68e846aae315c85d24643678a9",
        "url": "https://rest_api_root/v1/directory/users/a0417f68e846aae315c85d24643678a9",
        "name": "john",
        "display_name": "John",
        "avatar": "https://s3.amazonaws.com/bucket/b46ef40c-e22e-4ecf-a599-cace9fba839a_160x160.png"
    },
    "versions": [
        {
            "id": "5eb623487ea47001f6a70571",
            "url": "https://rest_api_root/v1/project/projects/5eb623f6a70571487ea47000/versions/5eb623487ea47001f6a70571",
            "name": "1.0.1",
            "start_at": 1565255712,
            "end_at": 1565255879,
            "stage": {
                "id": "5f44a8f8bb347b14b49624a1",
                "url": "https://rest_api_root/v1/project/stages/5f44a8f8bb347b14b49624a1",
                "name": "未开始",
                "type": "pending",
                "color": "#FA8888"
            }
        }
    ],
    "sprint": {
        "id": "5ecf7b74eaab845a2aa53138",
        "url": "https://rest_api_root/v1/project/projects/5eb623f6a70571487ea47000/sprints/5ecf7b74eaab845a2aa53138",
        "name": "Sprint 1",
        "start_at": 1589791860,
        "end_at": 1589791860,
        "status": "completed"
    },
    "state": {
        "id": "5c9b35de90ad7153c2062f18",
        "url": "https://rest_api_root/v1/project/work_item_states/5c9b35de90ad7153c2062f18",
        "name": "新建",
        "type": "pending",
        "color": "#ff7575"
    },
    "priority": {
        "id": "5eb623f6a70571487ea47111",
        "url": "https://rest_api_root/v1/project/work_item_priorities/5eb623f6a70571487ea47111",
        "name": "最高"
    },
    "board": null,
    "entry": null,
    "swimlane": null,
    "phase": null,
    "description": "这是一个缺陷的描述",
    "completed_at": 1583290347,
    "story_points": 1,
    "estimated_workload": 1,
    "remaining_workload": 1,
    "properties": {
        "prop_a": "prop_a_value",
        "prop_b": "prop_b_value",
        "severity": null,
        "replay_version": null,
        "reappear_probability": null,
        "bug_type": null,
        "reason": null,
        "solution": null,
        "replay_step": null
    },
    "tags": [],
    "participants": [
        {
            "id": "a0417f68e846aae315c85d24643678a9",
            "url": "https://rest_api_root/v1/participants/a0417f68e846aae315c85d24643678a9?principal_type=work_item&principal_id=5edca524cad2fa1125cb0630",
            "type": "user",
            "user": {
                "id": "a0417f68e846aae315c85d24643678a9",
                "url": "https://rest_api_root/v1/directory/users/a0417f68e846aae315c85d24643678a9",
                "name": "john",
                "display_name": "John",
                "avatar": "https://s3.amazonaws.com/bucket/b46ef40c-e22e-4ecf-a599-cace9fba839a_160x160.png"
            }
        }
    ],
    "created_at": 1583290300,
    "created_by": {
        "id": "a0417f68e846aae315c85d24643678a9",
        "url": "https://rest_api_root/v1/directory/users/a0417f68e846aae315c85d24643678a9",
        "name": "john",
        "display_name": "John",
        "avatar": "https://s3.amazonaws.com/bucket/b46ef40c-e22e-4ecf-a599-cace9fba839a_160x160.png"
    },
    "updated_at": 1583290300,
    "updated_by": {
        "id": "a0417f68e846aae315c85d24643678a9",
        "url": "https://rest_api_root/v1/directory/users/a0417f68e846aae315c85d24643678a9",
        "name": "john",
        "display_name": "John",
        "avatar": "https://s3.amazonaws.com/bucket/b46ef40c-e22e-4ecf-a599-cace9fba839a_160x160.png"
    },
    "is_archived": 0,
    "is_deleted": 0
}
```

## 创建一个项目

POST

```html
https://rest_api_root/v1/project/projects
```

权限: 企业令牌/用户令牌

请求参数

| 字段            | 类型     | 描述                                                         |
| :-------------- | :------- | :----------------------------------------------------------- |
| scope_type可选  | String   | 项目的所属类型。默认值`organization`。允许值分别表示企业可见和团队可见。默认值: `organization`允许值: `organization`, `user_group` |
| scope_id可选    | String   | 项目的所属id。当`scope_type`为`user_group`时，该字段必填，且表示团队id；当`scope_type`为其他值时，该字段无效。 |
| name            | String   | 项目的名称。最大长度为255。                                  |
| visibility可选  | String   | 项目的可见范围。允许值分别表示组织全部成员可见和仅项目成员可见。默认值: `private`允许值: `public`, `private` |
| type            | String   | 项目的类型。允许值: `kanban`, `scrum`, `waterfall`, `hybrid` |
| identifier      | String   | 项目的标识。在一个企业中这个标识是唯一的。项目的标识由大写英文字母/数字/下划线/连接线组成（不超过15个字符）。 |
| description可选 | String   | 项目的描述。                                                 |
| members可选     | Object[] | 项目成员的列表。当项目的`scope_type`变为`user_group`时，项目成员必须是`scope_id`指定的团队内的成员；当`scope_type`为其他值时，项目成员可以是任意成员或团队。 |
| members.id      | String   | 企业成员或团队的id。                                         |
| members.type    | String   | 项目成员的类型。允许值: `user`, `user_group`                 |
| start_at可选    | Number   | 项目开始的时间。                                             |
| end_at可选      | Number   | 项目结束的时间。                                             |
| assignee_id可选 | String   | 项目负责人的id。                                             |

请求示例：

```json
{
    "scope_type": "user_group",
    "scope_id": "63c8fb32729dee3334d96af7",
    "name": "Scrum项目",
    "visibility": "private",
    "type": "scrum",
    "identifier": "SCR",
    "description": "这是一个scrum类型的项目",
    "members": [
        {
            "id": "a0417f68e846aae315c85d24643678a9",
            "type": "user"
        }
    ],
    "start_at": 1680278400,
    "end_at": 1682870399,
    "assignee_id": "8168dd057b104c81bceb2e48bdf283d0"
}
```

响应示例：

```json
{
    "id": "5eb623f6a70571487ea47000",
    "url": "https://rest_api_root/v1/project/projects/5eb623f6a70571487ea47000",
    "type": "scrum",
    "process_id": "5fa690f1ae0571487ea49030",
    "scope_type": "user_group",
    "scope_id": "63c8fb32729dee3334d96af7",
    "name": "Scrum项目",
    "color": "#F693E7",
    "identifier": "SCR",
    "visibility": "private",
    "description": "这是一个scrum类型的项目",
    "state": {
        "id": "66cbf3b4b78a55fcd1a76296",
        "url": "http://rest_api_root/v1/project/project_states/66cbf3b4b78a55fcd1a76296",
        "name": "正常",
        "type": "in_progress"
    },
    "assignee": {
        "id": "8168dd057b104c81bceb2e48bdf283d0",
        "url": "http://rest_api_root/v1/directory/users/8168dd057b104c81bceb2e48bdf283d0",
        "name": "john",
        "display_name": "john",
        "avatar": "https://s3.amazonaws.com/bucket/b46ef40c-e22e-4ecf-a599-cace9fba839a_160x160.png"
    },
    "start_at": 1680278400,
    "end_at": 1682870399,
    "properties": {},
    "members": [
        {
            "id": "a0417f68e846aae315c85d24643678a9",
            "url": "https://rest_api_root/v1/project/projects/5eb623f6a70571487ea47000/members/a0417f68e846aae315c85d24643678a9",
            "type": "user",
            "user": {
                "id": "a0417f68e846aae315c85d24643678a9",
                "url": "https://rest_api_root/v1/directory/users/a0417f68e846aae315c85d24643678a9",
                "name": "john",
                "display_name": "John",
                "avatar": "https://s3.amazonaws.com/bucket/b46ef40c-e22e-4ecf-a599-cace9fba839a_160x160.png"
            }
        }
    ],
    "created_at": 1583290300,
    "created_by": {
        "id": "a0417f68e846aae315c85d24643678a9",
        "url": "https://rest_api_root/v1/directory/users/a0417f68e846aae315c85d24643678a9",
        "name": "john",
        "display_name": "John",
        "avatar": "https://s3.amazonaws.com/bucket/b46ef40c-e22e-4ecf-a599-cace9fba839a_160x160.png"
    },
    "updated_at": 1583290300,
    "updated_by": {
        "id": "a0417f68e846aae315c85d24643678a9",
        "url": "https://rest_api_root/v1/directory/users/a0417f68e846aae315c85d24643678a9",
        "name": "john",
        "display_name": "John",
        "avatar": "https://s3.amazonaws.com/bucket/b46ef40c-e22e-4ecf-a599-cace9fba839a_160x160.png"
    },
    "is_archived": 0,
    "is_deleted": 0
}
```