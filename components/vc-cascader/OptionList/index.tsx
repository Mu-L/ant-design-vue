/* eslint-disable default-case */
import Column from './Column';
import type { DefaultOptionType, SingleValueType } from '../Cascader';
import { isLeaf, toPathKey, toPathKeys, toPathValueStr } from '../utils/commonUtil';
import useActive from './useActive';
import useKeyboard from './useKeyboard';
import { toPathOptions } from '../utils/treeUtil';
import { computed, defineComponent, ref, shallowRef, watchEffect } from 'vue';
import { useBaseProps } from '../../vc-select';
import { useInjectCascader } from '../context';
import type { Key } from '../../_util/type';
import type { EventHandler } from '../../_util/EventInterface';

export default defineComponent({
  name: 'OptionList',
  inheritAttrs: false,
  setup(_props, context) {
    const { attrs, slots } = context;
    const baseProps = useBaseProps();
    const containerRef = ref<HTMLDivElement>();
    const rtl = computed(() => baseProps.direction === 'rtl');
    const {
      options,
      values,
      halfValues,
      fieldNames,
      changeOnSelect,
      onSelect,
      searchOptions,
      dropdownPrefixCls,
      loadData,
      expandTrigger,
      customSlots,
    } = useInjectCascader();

    const mergedPrefixCls = computed(() => dropdownPrefixCls.value || baseProps.prefixCls);

    // ========================= loadData =========================
    const loadingKeys = shallowRef<string[]>([]);
    const internalLoadData = (valueCells: Key[]) => {
      // Do not load when search
      if (!loadData.value || baseProps.searchValue) {
        return;
      }

      const optionList = toPathOptions(valueCells, options.value, fieldNames.value);
      const rawOptions = optionList.map(({ option }) => option);
      const lastOption = rawOptions[rawOptions.length - 1];

      if (lastOption && !isLeaf(lastOption, fieldNames.value)) {
        const pathKey = toPathKey(valueCells);

        loadingKeys.value = [...loadingKeys.value, pathKey];
        loadData.value(rawOptions);
      }
    };

    watchEffect(() => {
      if (loadingKeys.value.length) {
        loadingKeys.value.forEach(loadingKey => {
          const valueStrCells = toPathValueStr(loadingKey);
          const optionList = toPathOptions(
            valueStrCells,
            options.value,
            fieldNames.value,
            true,
          ).map(({ option }) => option);
          const lastOption = optionList[optionList.length - 1];

          if (
            !lastOption ||
            lastOption[fieldNames.value.children] ||
            isLeaf(lastOption, fieldNames.value)
          ) {
            loadingKeys.value = loadingKeys.value.filter(key => key !== loadingKey);
          }
        });
      }
    });

    // ========================== Values ==========================
    const checkedSet = computed(() => new Set(toPathKeys(values.value)));
    const halfCheckedSet = computed(() => new Set(toPathKeys(halfValues.value)));

    // ====================== Accessibility =======================
    const [activeValueCells, setActiveValueCells] = useActive();

    // =========================== Path ===========================
    const onPathOpen = (nextValueCells: Key[]) => {
      setActiveValueCells(nextValueCells);

      // Trigger loadData
      internalLoadData(nextValueCells);
    };

    const isSelectable = (option: DefaultOptionType) => {
      const { disabled } = option;

      const isMergedLeaf = isLeaf(option, fieldNames.value);
      return !disabled && (isMergedLeaf || changeOnSelect.value || baseProps.multiple);
    };

    const onPathSelect = (valuePath: SingleValueType, leaf: boolean, fromKeyboard = false) => {
      onSelect(valuePath);

      if (
        !baseProps.multiple &&
        (leaf || (changeOnSelect.value && (expandTrigger.value === 'hover' || fromKeyboard)))
      ) {
        baseProps.toggleOpen(false);
      }
    };

    // ========================== Option ==========================
    const mergedOptions = computed(() => {
      if (baseProps.searchValue) {
        return searchOptions.value;
      }

      return options.value;
    });

    // ========================== Column ==========================
    const optionColumns = computed(() => {
      const optionList = [{ options: mergedOptions.value }];
      let currentList = mergedOptions.value;
      for (let i = 0; i < activeValueCells.value.length; i += 1) {
        const activeValueCell = activeValueCells.value[i];
        const currentOption = currentList.find(
          option => option[fieldNames.value.value] === activeValueCell,
        );

        const subOptions = currentOption?.[fieldNames.value.children];
        if (!subOptions?.length) {
          break;
        }

        currentList = subOptions;
        optionList.push({ options: subOptions });
      }

      return optionList;
    });

    // ========================= Keyboard =========================
    const onKeyboardSelect = (selectValueCells: SingleValueType, option: DefaultOptionType) => {
      if (isSelectable(option)) {
        onPathSelect(selectValueCells, isLeaf(option, fieldNames.value), true);
      }
    };

    useKeyboard(
      context,
      mergedOptions,
      fieldNames,
      activeValueCells,
      onPathOpen,
      containerRef,
      onKeyboardSelect,
    );
    const onListMouseDown: EventHandler = event => {
      event.preventDefault();
    };
    return () => {
      // ========================== Render ==========================
      const {
        notFoundContent = slots.notFoundContent?.() || customSlots.value.notFoundContent?.(),
        multiple,
        toggleOpen,
      } = baseProps;
      // >>>>> Empty
      const isEmpty = !optionColumns.value[0]?.options?.length;

      const emptyList: DefaultOptionType[] = [
        {
          [fieldNames.value.label as 'label']: notFoundContent,
          [fieldNames.value.value as 'value']: '__EMPTY__',
          disabled: true,
        },
      ];
      const columnProps = {
        ...attrs,
        multiple: !isEmpty && multiple,
        onSelect: onPathSelect,
        onActive: onPathOpen,
        onToggleOpen: toggleOpen,
        checkedSet: checkedSet.value,
        halfCheckedSet: halfCheckedSet.value,
        loadingKeys: loadingKeys.value,
        isSelectable,
      };

      // >>>>> Columns
      const mergedOptionColumns = isEmpty ? [{ options: emptyList }] : optionColumns.value;

      const columnNodes = mergedOptionColumns.map((col, index) => {
        const prevValuePath = activeValueCells.value.slice(0, index);
        const activeValue = activeValueCells.value[index];

        return (
          <Column
            key={index}
            {...columnProps}
            prefixCls={mergedPrefixCls.value}
            options={col.options}
            prevValuePath={prevValuePath}
            activeValue={activeValue}
          />
        );
      });
      return (
        <div
          class={[
            `${mergedPrefixCls.value}-menus`,
            {
              [`${mergedPrefixCls.value}-menu-empty`]: isEmpty,
              [`${mergedPrefixCls.value}-rtl`]: rtl.value,
            },
          ]}
          onMousedown={onListMouseDown}
          ref={containerRef}
        >
          {columnNodes}
        </div>
      );
    };
  },
});
