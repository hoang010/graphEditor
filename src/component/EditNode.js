import React from 'react';
import 'antd/dist/antd.css';
import './form.css';
import { Modal, Form, Input } from 'antd';

const CollectionEditForm = ({selectedNodeType,visible, onCreate, onCancel,nodeTitle,nodeDesc }) => {
  const [form] = Form.useForm();
  return (

    <Modal
      visible={visible}
      title="Edit a Node"
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
        layout="vertical"
        name="form_in_modal"
        initialValues={{
          nodeTitle : nodeTitle,
          modifier: 'public',
          description : nodeDesc
        }}
      >
        <Form.Item
          label="Node Type"
        >
        <Input disabled placeholder = {selectedNodeType}/>

        </Form.Item>
        <Form.Item
          name="nodeTitle"
          label= {`${selectedNodeType} Title`}
          
          rules={[
            {
              required: true,
              message: `Please input the title of ${selectedNodeType}`,
            },
          ]}
        >
          <Input placeholder = "Input title"/>
        </Form.Item>

        <Form.Item 
          name="description" 
          label={`${selectedNodeType} Description`}>
          <Input type="textarea" placeholder ="Input description"/>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CollectionEditForm;