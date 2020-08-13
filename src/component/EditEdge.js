import React from 'react';
import 'antd/dist/antd.css';
import './form.css';
import { Modal, Form, Radio } from 'antd';
//edgetype: double/single
//edgedesc: forward/left/right
const EdgeEditForm = ({selectedEdgeType, selectedEdgeDesc, edgeTypeOptions, edgeDescOptions,visible, onCreate, onCancel }) => {

  const [form] = Form.useForm();
  return (
    <Modal
      visible={visible}
      title="Edit an Edge"
      okText="Edit"
      cancelText="Cancel"
      onCancel={onCancel}
      onOk={() => {
        form
          .validateFields()
          .then(values => {
            form.resetFields();
            onCreate(values);
          })
          .catch(info => {
            console.log('Validate Failed:', info);
          });
      }}
    >
      <Form
        form={form}
        layout="horizontal"
        name="form_in_modal"
        initialValues={{
            edgeType : selectedEdgeType,
            edgeDesc : selectedEdgeDesc,
            modifier: 'public',
        }}
      >
        <Form.Item
          name="edgeType"
          label= "EdgeType"
        >
          <Radio.Group
            disabled
            options={edgeTypeOptions}
            optionType = "button"
          />
        </Form.Item>

        <Form.Item 
          name="edgeDesc" 
          label="Edge Description"
          rules={[
            {
              required: true,
              message: `Please select Edge Description `,
            },
          ]}
        >
          <Radio.Group
              options={edgeDescOptions}
              optionType = "button"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EdgeEditForm;