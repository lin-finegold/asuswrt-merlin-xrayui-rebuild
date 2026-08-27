<template>
  <div class="formfontdesc">
    <p>VLESS is a stateless lightweight transport protocol that consists of inbound and outbound parts. It can serve as a bridge between Xray clients and servers.</p>
    <table width="100%" class="FormTable modal-form-table">
      <thead>
        <tr>
          <td colspan="2">VLESS</td>
        </tr>
      </thead>
      <tbody>
        <inbound-common :inbound="inbound"></inbound-common>
      </tbody>
    </table>
    <vless-clients :clients="clients" :proxy="inbound" mode="inbound"></vless-clients>
    <p v-if="clientConflict" class="native-config-warning">
      Cannot edit VLESS clients: both native users and legacy clients are present. Resolve the conflict in the raw configuration first.
    </p>
  </div>
</template>
<script lang="ts">
  import { defineComponent, ref } from 'vue';
  import VlessClients from '@clients/VlessClients.vue';
  import InboundCommon from './InboundCommon.vue';
  import { XrayProtocol } from '@/modules/CommonObjects';
  import { XrayInboundObject, XrayVlessInboundObject } from '@/modules/InboundObjects';
  import { NativeVlessInboundConflictError, projectVlessInboundClients } from '@/modules/NativeVlessInbound';

  export default defineComponent({
    name: 'VmessInbound',
    components: {
      VlessClients,
      InboundCommon
    },
    props: {
      inbound: XrayInboundObject<XrayVlessInboundObject>
    },
    setup(props) {
      const inbound = ref<XrayInboundObject<XrayVlessInboundObject>>(props.inbound ?? new XrayInboundObject<XrayVlessInboundObject>(XrayProtocol.VLESS, new XrayVlessInboundObject()));
      const clientConflict = ref(false);
      let clients = [] as any[];
      try {
        clients = projectVlessInboundClients((inbound.value.settings ?? {}) as any);
      } catch (error) {
        if (!(error instanceof NativeVlessInboundConflictError)) throw error;
        clientConflict.value = true;
      }
      return {
        inbound,
        clients,
        clientConflict
      };
    }
  });
</script>
